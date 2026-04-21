import mapboxgl from 'mapbox-gl'
// Have Vite bundle Mapbox's worker as a real module (with a stable URL it
// controls) instead of letting Mapbox stringify + Blob-URL its inlined worker
// source. The blob path picks up Vite's dev-mode HMR helpers (e.g.
// `__vite__injectQuery`) which then crash inside the worker context where
// those helpers don't exist. Same workaround documented in
// https://github.com/mapbox/mapbox-gl-js/issues/12656.
import MapboxWorker from 'mapbox-gl/dist/mapbox-gl-csp-worker?worker'
import { diff } from '@mapbox/mapbox-gl-style-spec'
import along from '@turf/along'
import length from '@turf/length'

;(mapboxgl as unknown as { workerClass: typeof Worker }).workerClass = MapboxWorker as unknown as typeof Worker
import type { AppStore } from '../../../app/store'
import { setHoveredFeature, setSelectedFeature, setTourActive, setPendingParkId } from '../../parks/interactionSlice'
import { setHoveredTrail, setSelectedTrail, setFlyAlongActive, setFlyAlongProgress, setFlyAlongPaused } from '../../trails/interactionSlice'
import { cameraObserved } from '../cameraSlice'
import type { HoveredFeatureProperties, ParkSearchResult, TrailProperties } from '../../../shared/types'
import { BASEMAP_OPTIONS } from '../../../shared/constants/basemaps'
import { getUiTheme, getEffectivePalette, applyUiTheme, applyMapFog, buildCustomMapStyle, getCustomLayerPaints } from '../../../shared/constants/uiThemes'
import type { MapCommand } from './commands'
import { selectAugmentationSpec, type AugmentationSpec } from './styleAugmentation'
import { stitchSatelliteTiles } from './satelliteTiles'

const SOURCE_LAYER = 'geo'
const TRAILS_SOURCE_LAYER = 'trails'
const CUSTOM_BASEMAP_ID = 'earth'

// Trail layers we route clicks through (in priority order — primary
// before casing so the wider hit-target doesn't shadow the actual line).
const TRAIL_INTERACTIVE_LAYERS = ['trails-primary', 'trails-thru']

// Selection overlay — Mapbox satellite tiles, polygon-clipped at canvas
// stitch time so the resulting image already has transparent edges that
// match the park silhouette exactly. The image source is inserted below
// the first road layer so road/admin/label vector layers still render on
// top:
//   basemap fills+hillshade → satellite → roads/labels → parks-fill → parks-outline
//
// Lifecycle: added on `selectPark` (click), removed on `deselectPark` (close).
// The orbit tour (Full detail) toggles independently on top of this overlay.
const SEL_SATELLITE_SRC_ID = 'selection-satellite-src'
const SEL_SATELLITE_LAYER_ID = 'selection-satellite'

interface CameraSnapshot {
  center: [number, number]
  zoom: number
  bearing: number
  pitch: number
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function getBoundsFromGeometry(
  geometry: GeoJSON.Geometry | null | undefined,
): [[number, number], [number, number]] | null {
  if (!geometry) return null

  let minLng = Infinity, maxLng = -Infinity
  let minLat = Infinity, maxLat = -Infinity

  function visit(coords: number[]) {
    if (coords[0] < minLng) minLng = coords[0]
    if (coords[0] > maxLng) maxLng = coords[0]
    if (coords[1] < minLat) minLat = coords[1]
    if (coords[1] > maxLat) maxLat = coords[1]
  }

  if (geometry.type === 'Point') {
    visit(geometry.coordinates)
  } else if (geometry.type === 'MultiPoint' || geometry.type === 'LineString') {
    geometry.coordinates.forEach(visit)
  } else if (geometry.type === 'Polygon') {
    geometry.coordinates[0].forEach(visit)
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach(poly => poly[0].forEach(visit))
  } else if (geometry.type === 'MultiLineString') {
    geometry.coordinates.forEach(line => line.forEach(visit))
  }

  if (!isFinite(minLng)) return null
  return [[minLng, minLat], [maxLng, maxLat]]
}

// Forward bearing in degrees (0=N, 90=E) from a→b on a sphere.
// Used by the fly-along loop to keep the camera pointed at the next sample.
function computeBearingDeg(a: [number, number], b: [number, number]): number {
  const toRad = (d: number): number => (d * Math.PI) / 180
  const toDeg = (r: number): number => (r * 180) / Math.PI
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const dLon = toRad(b[0] - a[0])
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

// ─── MapEngine ────────────────────────────────────────────────────────────────

export class MapEngine {
  private map: mapboxgl.Map
  private hoveredId: string | number | null = null
  private store: AppStore
  private currentAugmentation: AugmentationSpec | null = null
  private currentBasemapId: string

  // True once the very first 'load' has fired (and reset/restored on every
  // basemap swap). Used in place of `map.isStyleLoaded()` because the latter
  // can return false long after the style is actually usable — it waits on
  // *all* sources (PMTiles, terrain DEM, vector tiles) to settle, so any
  // streaming activity makes it flap. We only need to know "has the style
  // ever been ready?", not "is everything fully tiled?".
  private styleReady = false

  // ── Selection state (click → mask + satellite overlay) ──────────────────
  // siteId of the park currently selected (also the id we set the
  // `selected` feature-state on so the parks layer renders outline-only).
  private selectedSiteId: string | number | null = null
  // Camera state captured at the moment of *first* selection (preserved across
  // park-to-park transitions so closing always reverts to the user's
  // pre-interaction view).
  private preSelectionCamera: CameraSnapshot | null = null
  // Source-data listener used to retry overlay application when the selected
  // park's tiles haven't streamed in yet (e.g. selection from a search result
  // that flew the camera somewhere new).
  private selectionRetry: ((e: { sourceId?: string }) => void) | null = null
  // Cancels an in-flight satellite tile stitch when the selection changes
  // mid-fetch (rapid re-clicks, basemap swap, panel close).
  private satelliteAbort: AbortController | null = null
  // Active blob: URL backing the satellite image source. Held so we can
  // `URL.revokeObjectURL` on teardown — leaving these uncollected pins the
  // canvas in browser memory.
  private satelliteBlobUrl: string | null = null

  // ── Pending park id (deep-link restoration) ─────────────────────────────
  // Retry handler registered on `sourcedata` while waiting for national-parks
  // tiles to stream in so we can resolve a SITE_PID from the URL into a full
  // feature properties object.
  private pendingParkRetry: ((e: { sourceId?: string }) => void) | null = null

  // ── Tour state (Full detail → orbit on top of selection) ────────────────
  private tourSiteId: string | number | null = null
  private tourRaf: number | null = null
  private tourBearingStart = 0
  private tourStartTs = 0
  // Bearing/pitch captured when the orbit starts so we can restore the camera
  // when the tour ends programmatically (Show less / panel close).
  private preTourCamera: { bearing: number; pitch: number } | null = null

  // ── Trail interaction state ─────────────────────────────────────────────
  private hoveredTrailId: string | number | null = null
  private selectedTrailId: string | number | null = null
  // Source layer the selected trail was matched against — set on select so
  // we can clear feature-state on the right source/layer at deselect time
  // (a trail can come from either the local 'trails' layer or the
  // global 'thruhikes' layer).
  private selectedTrailSource: 'trails' | 'thruhikes' | null = null
  // Camera snapshot captured at fly-along start so a programmatic stop
  // (Stop button / panel close) can restore. User-gesture stops do not.
  private preFlyAlongCamera: CameraSnapshot | null = null
  // RAF + timing for the fly-along loop. `flyAlongLine` is the full
  // assembled polyline (multiple tile slices coalesced); `flyAlongLengthKm`
  // is precomputed so each tick is a cheap turf.along call.
  private flyAlongTrailId: string | number | null = null
  private flyAlongRaf: number | null = null
  private flyAlongDurationMs = 0
  private flyAlongLine: GeoJSON.Feature<GeoJSON.LineString> | null = null
  private flyAlongLengthKm = 0
  // t-based progress (0–1) advanced by real dt each frame so pause/seek are
  // trivial: pausing stops advancing t, seeking sets t directly.
  private flyAlongT = 0
  private flyAlongLastTs: number | null = null
  // Exponentially-smoothed bearing to avoid the camera snapping at each turn.
  private flyAlongSmoothedBearing = 0
  // DOM marker (person dot) placed on the trail and updated each frame.
  private flyAlongMarker: mapboxgl.Marker | null = null

  constructor(container: HTMLDivElement, store: AppStore) {
    this.store = store
    const state = store.getState()

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || ''

    const initialBasemap = BASEMAP_OPTIONS.find(b => b.id === state.mapStyle.selectedBasemap) ?? BASEMAP_OPTIONS[0]
    this.currentBasemapId = initialBasemap.id

    const initialPalette = getEffectivePalette(getUiTheme(state.mapStyle.selectedUiTheme), state.mapStyle.uiMode)
    const initialStyle = initialBasemap.style === null
      ? buildCustomMapStyle(initialPalette)
      : initialBasemap.style

    applyUiTheme(initialPalette)

    this.map = new mapboxgl.Map({
      container,
      style: initialStyle,
      center: [-98.5, 39.5],
      zoom: 1.8,
      pitch: 30,
      bearing: 0,
      projection: 'globe',
      attributionControl: false,
    })


    this.map.on('load', () => {
      this.styleReady = true
      this.addDataLayers()
    })
    this.registerMapEvents()

    if (import.meta.env.DEV) {
      ;(window as unknown as { __engine?: MapEngine; __store?: AppStore }).__engine = this
      ;(window as unknown as { __engine?: MapEngine; __store?: AppStore }).__store = store
    }
  }

  getMap(): mapboxgl.Map {
    return this.map
  }

  // Run `cb` once the WDPA (`national-parks`) vector source is present in
  // the style and finished its initial load. Used by URL deep-link
  // rehydration so we don't fire `resolveAndSelectPark` before the source
  // even exists — `querySourceFeatures` on a missing source is a no-op,
  // and we'd rather just register the retry once.
  //
  // Fires the callback at most once. Registering the listener pre-emptively
  // is safe because `sourcedata` events fire for the source-add itself, so
  // we won't miss the transition from "not in style" → "loaded".
  whenWdpaReady(cb: () => void): void {
    if (this.map.getSource('national-parks') && this.map.isSourceLoaded('national-parks')) {
      cb()
      return
    }
    const handler = (e: { sourceId?: string }): void => {
      if (e.sourceId !== 'national-parks') return
      if (!this.map.isSourceLoaded('national-parks')) return
      this.map.off('sourcedata', handler)
      cb()
    }
    this.map.on('sourcedata', handler)
  }

  destroy(): void {
    this.stopTour({ restoreCamera: false })
    this.stopFlyAlong({ restoreCamera: false })
    this.clearSelectionOverlay()
    this.map.remove()
  }

  // ─── Trails: hover + select ─────────────────────────────────────────────

  setTrailHover(id: string | number | null): void {
    if (this.hoveredTrailId === id) return
    if (this.hoveredTrailId !== null) {
      this.setTrailFeatureStateBoth(this.hoveredTrailId, { hover: false })
    }
    this.hoveredTrailId = id
    if (id !== null) {
      this.setTrailFeatureStateBoth(id, { hover: true })
    }
  }

  selectTrail(id: string | number): void {
    if (this.selectedTrailId === id) return
    if (this.selectedTrailId !== null) this.deselectTrail()
    this.selectedTrailId = id

    // Try the local trails layer first, then thruhikes — promoteId is
    // 'osm_id' on both so the same id resolves either way. The source we
    // *find* the feature in dictates which feature-state we paint.
    const trailsHit = this.map.getSource('trails')
      ? this.map.querySourceFeatures('trails', {
          sourceLayer: TRAILS_SOURCE_LAYER,
          filter: ['==', ['get', 'osm_id'], id],
        })
      : []
    const thruHit = trailsHit.length === 0 && this.map.getSource('thruhikes')
      ? this.map.querySourceFeatures('thruhikes', {
          sourceLayer: 'thruhikes',
          filter: ['==', ['get', 'osm_id'], id],
        })
      : []
    const hits = trailsHit.length > 0 ? trailsHit : thruHit
    this.selectedTrailSource = trailsHit.length > 0 ? 'trails' : (thruHit.length > 0 ? 'thruhikes' : null)

    if (this.selectedTrailSource) {
      this.map.setFeatureState(
        {
          source: this.selectedTrailSource,
          sourceLayer: this.selectedTrailSource === 'trails' ? TRAILS_SOURCE_LAYER : 'thruhikes',
          id,
        },
        { selected: true },
      )
    }

    // Frame the trail so the panel that's about to open isn't pointing at
    // empty ocean. Modest pitch — fly-along is the dramatic camera ride.
    const bounds = this.computeBoundsFromFeatures(hits)
    if (bounds) {
      this.map.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 80, right: 380 },
        maxZoom: 14,
        duration: 900,
      })
    }
  }

  deselectTrail(): void {
    this.stopFlyAlong({ restoreCamera: false })
    if (this.selectedTrailId !== null && this.selectedTrailSource) {
      this.map.setFeatureState(
        {
          source: this.selectedTrailSource,
          sourceLayer: this.selectedTrailSource === 'trails' ? TRAILS_SOURCE_LAYER : 'thruhikes',
          id: this.selectedTrailId,
        },
        { selected: false },
      )
    }
    this.selectedTrailId = null
    this.selectedTrailSource = null
  }

  // Hover state lives on whichever of (trails, thruhikes) holds the feature.
  // Cheap to set on both and let the no-op happen than to query first.
  private setTrailFeatureStateBoth(id: string | number, state: Record<string, unknown>): void {
    if (this.map.getSource('trails')) {
      this.map.setFeatureState(
        { source: 'trails', sourceLayer: TRAILS_SOURCE_LAYER, id },
        state,
      )
    }
    if (this.map.getSource('thruhikes')) {
      this.map.setFeatureState(
        { source: 'thruhikes', sourceLayer: 'thruhikes', id },
        state,
      )
    }
  }

  private computeBoundsFromFeatures(
    features: mapboxgl.MapboxGeoJSONFeature[],
  ): [[number, number], [number, number]] | null {
    let bounds: [[number, number], [number, number]] | null = null
    for (const f of features) {
      const b = getBoundsFromGeometry(f.geometry as GeoJSON.Geometry)
      if (!b) continue
      if (!bounds) bounds = b
      else {
        bounds = [
          [Math.min(bounds[0][0], b[0][0]), Math.min(bounds[0][1], b[0][1])],
          [Math.max(bounds[1][0], b[1][0]), Math.max(bounds[1][1], b[1][1])],
        ]
      }
    }
    return bounds
  }

  // ─── Fly-along: camera ride down a trail polyline ──────────────────────

  // Mirrors `startTour`: assemble the trail polyline from one or more tile
  // slices, then RAF-step the camera along it via `turf.along`. Each
  // frame jumps to the sampled point, sets bearing to face the next
  // sample, and holds a fixed pitch — the visual is a pilot's-eye flight
  // along the trail.
  startFlyAlong(id: string | number): void {
    if (this.selectedTrailId !== id) return  // selection guard
    if (this.flyAlongTrailId === id) return  // already running

    this.stopFlyAlong({ restoreCamera: false })  // re-entrant safety

    const line = this.assembleTrailLine(id)
    if (!line || line.geometry.coordinates.length < 2) return

    this.flyAlongTrailId = id
    this.flyAlongLine = line
    this.flyAlongLengthKm = length(line, { units: 'kilometers' })
    this.flyAlongDurationMs = 30_000
    this.flyAlongT = 0
    this.flyAlongLastTs = null
    this.flyAlongSmoothedBearing = this.map.getBearing()

    // Hiker marker — SVG icon using the active trail color.
    const mapState = this.store.getState().mapStyle
    const palette = getEffectivePalette(getUiTheme(mapState.selectedUiTheme), mapState.uiMode)
    const markerEl = document.createElement('div')
    markerEl.className = 'fly-along-hiker'
    markerEl.style.color = palette.mapTrail
    markerEl.innerHTML = `<svg viewBox="0 0 128 128" width="22" height="22" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M63.5,20c5.5,0,10-4.5,10-10c0-5.5-4.5-10-10-10c-5.5,0-10,4.5-10,10C53.5,15.5,58,20,63.5,20z"/>
      <path d="M39.7,50.5l7-28.9c0.4-1.5-0.6-3.1-2.1-3.5l-8.3-2c-1.6-0.4-3.1,0.6-3.5,2.1l-7,28.9c-0.4,1.5,0.6,3.1,2.1,3.5l8.3,2C37.7,53,39.3,52.1,39.7,50.5z"/>
      <path d="M104,31.6c-1.1,0-2,0.9-2.3,2L85,124.5c0,0.1,0,0.1,0,0.2c0,1.3,1,2.3,2.3,2.3c1.2,0,2.1-0.9,2.3-2l16.7-90.8v-0.2C106.3,32.7,105.3,31.6,104,31.6z"/>
      <path d="M64.4,52.5l1.3-5.8l1,4.6c0.9,3,3.7,3.3,3.7,3.3l16.2,4.1c0.3,0.1,0.6,0.1,1,0.1c2.7,0,4.8-2.1,4.8-4.8c0-2.3-1.6-4.2-3.7-4.7l-14.1-3.5L70.8,30c-1.8-8.8-10.2-8.6-10.2-8.6c-8.1-0.2-10.2,8.3-10.2,8.3l-21.1,88.7c-0.1,0.5-0.1,0.9-0.1,1.4c0,3.9,3.1,7,7,7c3.2,0,5.9-2.1,6.7-5L55,72l11.5,49.6c0.7,3.1,3.5,5.3,6.8,5.3c3.9,0,7-3.1,7-7c0-0.5-0.1-1-0.2-1.5L64.4,52.5z"/>
    </svg>`
    this.flyAlongMarker = new mapboxgl.Marker({ element: markerEl, anchor: 'bottom' })
      .setLngLat(line.geometry.coordinates[0] as [number, number])
      .addTo(this.map)

    this.store.dispatch(setFlyAlongProgress(0))

    // Snapshot the camera so a programmatic stop can restore it.
    const c = this.map.getCenter()
    this.preFlyAlongCamera = {
      center: [c.lng, c.lat],
      zoom: this.map.getZoom(),
      bearing: this.map.getBearing(),
      pitch: this.map.getPitch(),
    }

    // Frame the trail at fly-along pitch, then start the RAF loop after
    // the camera lands. `once('moveend')` is keyed against the launch id
    // so a fast user re-selection doesn't hijack a stale frame.
    const bounds = getBoundsFromGeometry(line.geometry)
    if (bounds) {
      this.map.fitBounds(bounds, {
        padding: 100,
        pitch: 65,
        duration: 1400,
        maxZoom: 14,
      })
    }

    const launchId = id
    this.map.once('moveend', () => {
      if (this.flyAlongTrailId !== launchId) return
      this.runFlyAlongLoop()
    })

    // User gesture cancels — same handler shape as the park orbit tour.
    this.map.on('dragstart', this.onFlyAlongInteraction)
    this.map.on('rotatestart', this.onFlyAlongInteraction)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.map.on('zoomstart', this.onFlyAlongInteraction as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.map.on('pitchstart', this.onFlyAlongInteraction as any)
  }

  stopFlyAlong(opts: { restoreCamera?: boolean } = {}): void {
    if (this.flyAlongRaf !== null) {
      cancelAnimationFrame(this.flyAlongRaf)
      this.flyAlongRaf = null
    }
    this.map.off('dragstart', this.onFlyAlongInteraction)
    this.map.off('rotatestart', this.onFlyAlongInteraction)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.map.off('zoomstart', this.onFlyAlongInteraction as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.map.off('pitchstart', this.onFlyAlongInteraction as any)

    if (this.flyAlongTrailId !== null) {
      this.flyAlongTrailId = null
      this.flyAlongLine = null
      this.flyAlongLengthKm = 0
      this.flyAlongMarker?.remove()
      this.flyAlongMarker = null
      this.store.dispatch(setFlyAlongPaused(false))

      const restore = opts.restoreCamera ?? true
      if (restore && this.preFlyAlongCamera) {
        const snap = this.preFlyAlongCamera
        this.map.easeTo({
          center: snap.center,
          zoom: snap.zoom,
          bearing: snap.bearing,
          pitch: snap.pitch,
          duration: 1100,
        })
      }
      this.preFlyAlongCamera = null
    }
  }

  // Class-property handler — needed so the same reference can be passed
  // to .on() and .off(). Bails out silently for programmatic moves
  // (originalEvent is undefined for fitBounds / setBearing, so only real
  // user gestures cancel the ride).
  private onFlyAlongInteraction = (e: { originalEvent?: Event }): void => {
    if (!e.originalEvent) return
    this.stopFlyAlong({ restoreCamera: false })
    this.store.dispatch(setFlyAlongActive(false))
  }

  private runFlyAlongLoop(): void {
    const tick = (now: number): void => {
      if (this.flyAlongTrailId === null || !this.flyAlongLine) return

      const trailState = this.store.getState().trailsInteraction

      if (trailState.flyAlongPaused) {
        // User is scrubbing the chart — move marker to chart position but
        // hold the camera where it is. Reset the clock so resuming is seamless.
        this.flyAlongT = trailState.flyAlongProgress
        this.flyAlongLastTs = null
        const distKm = this.flyAlongT * this.flyAlongLengthKm
        const pt = along(this.flyAlongLine, distKm, { units: 'kilometers' })
        this.flyAlongMarker?.setLngLat(pt.geometry.coordinates as [number, number])
        this.flyAlongRaf = requestAnimationFrame(tick)
        return
      }

      // Advance t by real elapsed time so the duration stays wall-clock
      // accurate regardless of frame rate or how long a pause lasted.
      if (this.flyAlongLastTs !== null) {
        const dt = now - this.flyAlongLastTs
        this.flyAlongT = Math.min(this.flyAlongT + dt / this.flyAlongDurationMs, 1)
      }
      this.flyAlongLastTs = now

      const distKm = this.flyAlongT * this.flyAlongLengthKm
      // 150 m lookahead — samples direction over a longer chord so micro-wiggles
      // in the polyline don't snap the bearing every frame.
      const lookAheadKm = Math.min(distKm + 0.15, this.flyAlongLengthKm)
      const pt    = along(this.flyAlongLine, distKm,      { units: 'kilometers' })
      const ahead = along(this.flyAlongLine, lookAheadKm, { units: 'kilometers' })

      const [x1, y1] = pt.geometry.coordinates
      const [x2, y2] = ahead.geometry.coordinates
      const targetBearing = computeBearingDeg([x1, y1], [x2, y2])

      // Exponential bearing lerp with angle-wrap: factor 0.06 at 60fps gives
      // ~500 ms to complete a 90° turn — feels like a plane banking gently.
      const delta = ((targetBearing - this.flyAlongSmoothedBearing + 540) % 360) - 180
      this.flyAlongSmoothedBearing = (this.flyAlongSmoothedBearing + delta * 0.06 + 360) % 360

      this.flyAlongMarker?.setLngLat([x1, y1])

      // easeTo with short duration lets Mapbox blend between frames rather
      // than teleporting — combined with the bearing lerp this removes jitter
      // entirely at the cost of ~80 ms lag (imperceptible at trail scale).
      this.map.easeTo({
        center: [x1, y1],
        bearing: this.flyAlongSmoothedBearing,
        pitch: 65,
        duration: 80,
        easing: t => t,
      })

      this.store.dispatch(setFlyAlongProgress(this.flyAlongT))

      if (this.flyAlongT >= 1) {
        this.stopFlyAlong({ restoreCamera: true })
        this.store.dispatch(setFlyAlongActive(false))
        return
      }
      this.flyAlongRaf = requestAnimationFrame(tick)
    }

    this.flyAlongRaf = requestAnimationFrame(tick)
  }

  // Public surface for the TrailDetailPanel: returns the assembled
  // polyline + sampled elevations for the elevation-profile SVG. Returns
  // null if the trail's tiles aren't loaded yet, or if no terrain DEM is
  // available (in which case the panel renders the stat grid only).
  getSelectedTrailProfile(samples = 60): {
    line: GeoJSON.Feature<GeoJSON.LineString>
    lengthKm: number
    elevations: number[]   // meters; same length as `samples`
    gainM: number
    lossM: number
  } | null {
    if (this.selectedTrailId === null) return null
    const line = this.assembleTrailLine(this.selectedTrailId)
    if (!line || line.geometry.coordinates.length < 2) return null

    const lengthKm = length(line, { units: 'kilometers' })

    // Sample elevations along the line via the live DEM. If terrain isn't
    // enabled, queryTerrainElevation returns null and we feed the panel a
    // zero array (it'll render a flat baseline + omit the gain/loss row).
    const elevations: number[] = []
    let gainM = 0
    let lossM = 0
    let prev: number | null = null
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1)
      const pt = along(line, t * lengthKm, { units: 'kilometers' })
      const [lng, lat] = pt.geometry.coordinates
      const elev = this.map.queryTerrainElevation([lng, lat]) ?? 0
      elevations.push(elev)
      if (prev !== null) {
        const d = elev - prev
        if (d > 0) gainM += d
        else lossM -= d
      }
      prev = elev
    }
    return { line, lengthKm, elevations, gainM, lossM }
  }

  // Coalesces tile-piece geometries (the same trail can span multiple
  // vector tiles, just like a park polygon does) into a single
  // LineString. Tippecanoe slices LineStrings at tile borders, so we
  // concatenate all pieces in their natural source order — good enough
  // for `turf.along` to produce a smooth ride for any non-self-crossing
  // trail. Self-crossing or branched routes will look choppy at junctions
  // (acceptable v1 trade-off).
  private assembleTrailLine(id: string | number): GeoJSON.Feature<GeoJSON.LineString> | null {
    const sourceId = this.selectedTrailSource ?? 'trails'
    if (!this.map.getSource(sourceId)) return null
    const sourceLayer = sourceId === 'trails' ? TRAILS_SOURCE_LAYER : 'thruhikes'

    const features = this.map.querySourceFeatures(sourceId, {
      sourceLayer,
      filter: ['==', ['get', 'osm_id'], id],
    })

    const coords: number[][] = []
    for (const f of features) {
      const g = f.geometry
      if (g.type === 'LineString') {
        for (const c of g.coordinates) coords.push(c)
      } else if (g.type === 'MultiLineString') {
        for (const line of g.coordinates) for (const c of line) coords.push(c)
      }
    }
    if (coords.length < 2) return null
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    }
  }

  // ─── Selection: click → mask + satellite overlay ─────────────────────────

  // Marks a park as selected and overlays the satellite-inside-mask styling
  // around it. Idempotent for the same `siteId` (re-applies overlay only —
  // useful after a basemap swap nukes the live style).
  //
  // If the park's tiles aren't loaded yet (e.g. selection arrived from a
  // search result that flew the camera somewhere new), we register a
  // one-shot `sourcedata` listener that retries once the parks source streams
  // in the missing geometry.
  selectPark(siteId: string | number): void {
    const reapplying = this.selectedSiteId === siteId

    if (!reapplying && this.selectedSiteId !== null) {
      // Transitioning park-to-park: tear down old overlay + tour, but keep
      // `preSelectionCamera` so the close action still reverts to the user's
      // original (pre-first-click) camera.
      this.stopTour({ restoreCamera: false })
      this.clearSelectionOverlayLayers()
    }

    this.cancelSelectionRetry()

    if (!reapplying) {
      const c = this.map.getCenter()
      // Capture only if we don't already have a snapshot (preserve original
      // pre-selection state across park-to-park transitions and basemap
      // swaps that re-run selectPark).
      if (!this.preSelectionCamera) {
        this.preSelectionCamera = {
          center: [c.lng, c.lat],
          zoom: this.map.getZoom(),
          bearing: this.map.getBearing(),
          pitch: this.map.getPitch(),
        }
      }
      this.selectedSiteId = siteId
    }

    const result = this.getFeatureBoundsAndGeometry(siteId)
    if (!result) {
      // Tiles not in cache yet. Wait for the parks source to stream in, then
      // retry. Keep selectedSiteId set so `clearSelectionOverlayLayers()`
      // (called by deselect) still wipes feature-state if user cancels first.
      this.scheduleSelectionRetry(siteId)
      return
    }

    this.applySelectionOverlay(siteId, result.bounds, result.geometry)

    if (!reapplying) {
      this.map.fitBounds(result.bounds, {
        padding: 60,
        maxZoom: 10,
        duration: 1200,
      })
    }
  }

  // Tears down the selection overlay AND the tour, then restores the camera
  // to its pre-selection state. Triggered by closing the detail panel.
  deselectPark(): void {
    this.stopTour({ restoreCamera: false })
    this.clearSelectionOverlay()

    if (this.preSelectionCamera) {
      const snap = this.preSelectionCamera
      this.preSelectionCamera = null
      this.map.easeTo({
        center: snap.center,
        zoom: snap.zoom,
        bearing: snap.bearing,
        pitch: snap.pitch,
        duration: 1000,
      })
    }
  }

  private clearSelectionOverlay(): void {
    this.cancelSelectionRetry()
    this.clearSelectionOverlayLayers()
    this.selectedSiteId = null
  }

  // Removes feature-state + satellite/mask layers but does NOT clear
  // `selectedSiteId` or `preSelectionCamera`. Used by both the full deselect
  // path and the park-to-park transition inside `selectPark`.
  private clearSelectionOverlayLayers(): void {
    if (this.selectedSiteId !== null && this.map.getSource('national-parks')) {
      this.map.setFeatureState(
        { source: 'national-parks', sourceLayer: SOURCE_LAYER, id: this.selectedSiteId },
        { selected: false },
      )
    }
    this.removeSelectionLayers()
  }

  private scheduleSelectionRetry(siteId: string | number): void {
    this.cancelSelectionRetry()
    const handler = (e: { sourceId?: string }): void => {
      if (e.sourceId !== 'national-parks') return
      // Selection may have changed while we were waiting; bail if so.
      if (this.selectedSiteId !== siteId) {
        this.cancelSelectionRetry()
        return
      }
      const result = this.getFeatureBoundsAndGeometry(siteId)
      if (!result) return  // tiles still streaming, wait for next event
      this.cancelSelectionRetry()
      this.applySelectionOverlay(siteId, result.bounds, result.geometry)
    }
    this.selectionRetry = handler
    this.map.on('sourcedata', handler)
  }

  private cancelSelectionRetry(): void {
    if (this.selectionRetry) {
      this.map.off('sourcedata', this.selectionRetry)
      this.selectionRetry = null
    }
  }

  private applySelectionOverlay(
    siteId: string | number,
    bounds: [[number, number], [number, number]],
    geometry: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
  ): void {
    this.map.setFeatureState(
      { source: 'national-parks', sourceLayer: SOURCE_LAYER, id: siteId },
      { selected: true },
    )
    // Fire-and-forget — feature-state highlight is instant; satellite +
    // mask materialise once the tile fetch + stitch resolves. Race
    // protection lives inside `addSelectionSatellite`.
    void this.addSelectionSatellite(siteId, bounds, geometry)
  }

  // ─── Tour: orbit-around-the-selected-park ────────────────────────────────

  // Begins the orbit animation around the currently-selected park. Selection
  // (mask + satellite) must already be active — `startTour` is purely the
  // camera/RAF layer on top.
  startTour(siteId: string | number): void {
    // Selection must match — guard against stale dispatches.
    if (this.selectedSiteId !== siteId) return
    if (this.tourSiteId === siteId) return  // already orbiting

    // Re-entrant safety for the rare case of a tour swap without deselect.
    this.stopTour({ restoreCamera: false })

    const result = this.getFeatureBoundsAndGeometry(siteId)
    if (!result) {
      // Tiles disappeared between selection and tour start (very edge case).
      // Bail silently — user can re-toggle.
      return
    }
    const { bounds } = result

    this.preTourCamera = {
      bearing: this.map.getBearing(),
      pitch: this.map.getPitch(),
    }
    this.tourSiteId = siteId

    this.map.fitBounds(bounds, {
      padding: 50,
      pitch: 60,
      bearing: 0,
      duration: 1800,
      maxZoom: 14,
    })

    // Begin orbit once the framing animation lands. `once('moveend')` is
    // tied to this specific siteId so a fast user re-selection doesn't
    // start a stale orbit.
    const launchSiteId = siteId
    this.map.once('moveend', () => {
      if (this.tourSiteId !== launchSiteId) return
      this.runTourLoop()
    })

    // Bail out of the tour the moment the user grabs the camera. Programmatic
    // moves (our own setBearing inside the RAF, fitBounds, etc.) don't carry
    // an `originalEvent`, so this only fires for real user gestures.
    // Cast through `unknown`: Mapbox's typings for zoomstart/pitchstart omit
    // `originalEvent` even though it's present at runtime for user gestures.
    this.map.on('dragstart', this.onUserInteraction)
    this.map.on('rotatestart', this.onUserInteraction)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.map.on('zoomstart', this.onUserInteraction as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.map.on('pitchstart', this.onUserInteraction as any)
  }

  // `restoreCamera` controls whether we ease bearing/pitch back to their
  // pre-tour values. Programmatic stops (Show less, panel close) restore;
  // user-gesture stops do not (the user is actively driving the camera —
  // fighting them would feel awful).
  stopTour(opts: { restoreCamera?: boolean } = {}): void {
    if (this.tourRaf !== null) {
      cancelAnimationFrame(this.tourRaf)
      this.tourRaf = null
    }

    this.map.off('dragstart', this.onUserInteraction)
    this.map.off('rotatestart', this.onUserInteraction)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.map.off('zoomstart', this.onUserInteraction as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.map.off('pitchstart', this.onUserInteraction as any)

    if (this.tourSiteId !== null) {
      this.tourSiteId = null
      const restore = opts.restoreCamera ?? true
      if (restore && this.preTourCamera) {
        this.map.easeTo({
          bearing: this.preTourCamera.bearing,
          pitch: this.preTourCamera.pitch,
          duration: 1000,
        })
      }
      this.preTourCamera = null
    }
  }

  // Pre-fetches Mapbox satellite tiles covering the park's bbox at an
  // adaptive zoom (highest z whose grid fits inside ~4096px), stitches them
  // into a single canvas clipped to the park polygon at stitch time, and
  // adds the result as a Mapbox `image` source. The clipped PNG has
  // transparent edges that match the silhouette exactly — no separate
  // mask layer required, and the basemap shows through naturally outside
  // the park.
  //
  // Async: the feature-state highlight is applied immediately by the caller;
  // the satellite materialises here once the fetch + stitch completes.
  // `forSiteId` is the selection at the moment of dispatch — if the user
  // re-selects mid-fetch, the abort signal cancels the in-flight requests
  // and we bail before mutating the live style.
  private async addSelectionSatellite(
    forSiteId: string | number,
    bounds: [[number, number], [number, number]],
    geometry: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
  ): Promise<void> {
    if (this.map.getSource(SEL_SATELLITE_SRC_ID)) return  // already added

    // Cancel any prior fetch (rapid re-clicks) before starting a new one.
    this.satelliteAbort?.abort()
    const abort = new AbortController()
    this.satelliteAbort = abort

    const token = mapboxgl.accessToken ?? ''
    let stitched
    try {
      stitched = await stitchSatelliteTiles(bounds, geometry, token, abort.signal)
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return
      console.warn('[MapEngine] satellite tile stitch failed', err)
      if (this.satelliteAbort === abort) this.satelliteAbort = null
      return
    }

    // Selection (or basemap) may have changed during the fetch. Discard the
    // stitched blob and bail — a fresh `addSelectionSatellite` will run for
    // the new state.
    if (
      this.satelliteAbort !== abort ||
      this.selectedSiteId !== forSiteId ||
      this.map.getSource(SEL_SATELLITE_SRC_ID)
    ) {
      URL.revokeObjectURL(stitched.imageUrl)
      return
    }
    this.satelliteAbort = null
    this.satelliteBlobUrl = stitched.imageUrl

    this.map.addSource(SEL_SATELLITE_SRC_ID, {
      type: 'image',
      url: stitched.imageUrl,
      coordinates: stitched.coordinates,
    })

    // Insert below roads so road/admin/label vector layers render on top of
    // the satellite. Falls back to parks-fill on non-earth basemaps.
    const before = this.map.getLayer('road-minor')
      ? 'road-minor'
      : this.map.getLayer('parks-fill') ? 'parks-fill' : undefined

    this.map.addLayer(
      {
        id: SEL_SATELLITE_LAYER_ID,
        type: 'raster',
        source: SEL_SATELLITE_SRC_ID,
        paint: {
          'raster-opacity': 1,
          'raster-fade-duration': 300,
        },
      },
      before,
    )
  }

  private removeSelectionLayers(): void {
    // Cancel any in-flight fetch — its callback would no-op anyway thanks to
    // the `selectedSiteId` guard, but aborting saves the bandwidth.
    this.satelliteAbort?.abort()
    this.satelliteAbort = null

    if (this.map.getLayer(SEL_SATELLITE_LAYER_ID)) {
      this.map.removeLayer(SEL_SATELLITE_LAYER_ID)
    }
    if (this.map.getSource(SEL_SATELLITE_SRC_ID)) {
      this.map.removeSource(SEL_SATELLITE_SRC_ID)
    }

    // Release the blob: the stitched canvas is otherwise pinned in browser
    // memory by the URL alone, even after the source is removed.
    if (this.satelliteBlobUrl) {
      URL.revokeObjectURL(this.satelliteBlobUrl)
      this.satelliteBlobUrl = null
    }
  }

  private runTourLoop(): void {
    this.tourBearingStart = this.map.getBearing()
    this.tourStartTs = performance.now()

    // ~4°/s = a full revolution every 90s. Slow enough to read the terrain,
    // fast enough that you sense motion within a few frames of opening detail.
    const ROT_DEG_PER_SEC = 4

    const tick = (now: number) => {
      if (this.tourSiteId === null) return
      const elapsed = (now - this.tourStartTs) / 1000
      const bearing = (this.tourBearingStart + elapsed * ROT_DEG_PER_SEC) % 360
      this.map.setBearing(bearing)
      this.tourRaf = requestAnimationFrame(tick)
    }

    this.tourRaf = requestAnimationFrame(tick)
  }

  // Class-property so we can pass the same reference to .on() and .off().
  // Stops the orbit *without* restoring the camera (the user is actively
  // moving it — fighting them would feel awful) and syncs Redux so the
  // detail panel flips its "Show less" button back to "Full details".
  private onUserInteraction = (e: { originalEvent?: Event }): void => {
    if (!e.originalEvent) return
    this.stopTour({ restoreCamera: false })
    this.store.dispatch(setTourActive(false))
  }

  // Collects every tile-piece sharing this SITE_PID and returns:
  //   - the unioned bbox (for fitBounds + scoping the satellite source)
  //   - a MultiPolygon Feature combining all pieces (for the turf inverse
  //     mask). Tile-piece boundaries inside the polygon are invisible because
  //     the mask only renders OUTSIDE the union.
  private getFeatureBoundsAndGeometry(siteId: string | number): {
    bounds: [[number, number], [number, number]]
    geometry: GeoJSON.Feature<GeoJSON.MultiPolygon>
  } | null {
    const features = this.map.querySourceFeatures('national-parks', {
      sourceLayer: SOURCE_LAYER,
      filter: ['==', ['get', 'SITE_PID'], siteId],
    })

    let bounds: [[number, number], [number, number]] | null = null
    const polygons: number[][][][] = []  // array of Polygon `coordinates`

    for (const f of features) {
      const geom = f.geometry as GeoJSON.Geometry

      const b = getBoundsFromGeometry(geom)
      if (b) {
        if (!bounds) {
          bounds = b
        } else {
          bounds = [
            [Math.min(bounds[0][0], b[0][0]), Math.min(bounds[0][1], b[0][1])],
            [Math.max(bounds[1][0], b[1][0]), Math.max(bounds[1][1], b[1][1])],
          ]
        }
      }

      if (geom.type === 'Polygon') {
        polygons.push(geom.coordinates)
      } else if (geom.type === 'MultiPolygon') {
        for (const poly of geom.coordinates) polygons.push(poly)
      }
    }

    if (!bounds || polygons.length === 0) return null

    return {
      bounds,
      geometry: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'MultiPolygon', coordinates: polygons },
      },
    }
  }

  // Resolves a SITE_PID string (from a deep-link URL) into the full feature
  // properties and dispatches setSelectedFeature. If the tiles aren't loaded
  // yet, retries on every `sourcedata` event until the park is found.
  resolveAndSelectPark(id: string): void {
    this.cancelPendingParkRetry()
    if (this.tryResolvePark(id)) return

    const handler = (e: { sourceId?: string }): void => {
      if (e.sourceId !== 'national-parks') return
      if (this.tryResolvePark(id)) this.cancelPendingParkRetry()
    }
    this.pendingParkRetry = handler
    this.map.on('sourcedata', handler)
  }

  private tryResolvePark(id: string): boolean {
    const features = this.map.querySourceFeatures('national-parks', {
      sourceLayer: SOURCE_LAYER,
      // Coerce to string so numeric SITE_PID values match the string from the URL.
      filter: ['==', ['to-string', ['get', 'SITE_PID']], id],
    })
    if (features.length === 0) return false
    this.store.dispatch(setSelectedFeature(features[0].properties as HoveredFeatureProperties))
    this.store.dispatch(setPendingParkId(null))
    return true
  }

  private cancelPendingParkRetry(): void {
    if (this.pendingParkRetry) {
      this.map.off('sourcedata', this.pendingParkRetry)
      this.pendingParkRetry = null
    }
  }

  execute(cmd: MapCommand): void {
    switch (cmd.type) {
      case 'STYLE_RECONCILE':      return this.reconcile(cmd.spec)
      case 'BASEMAP_CHANGE':       return this.handleBasemapChange(cmd.basemapId)
      case 'UI_THEME_CHANGE':      return this.handleUiThemeChange(cmd.themeId)
      case 'FLY_TO':               return void this.map.flyTo(cmd.options as mapboxgl.EasingOptions)
      case 'FIT_BOUNDS':           return void this.map.fitBounds(cmd.bounds, cmd.options)
      case 'EASE_TO':              return void this.map.easeTo(cmd.options as mapboxgl.EasingOptions & { duration?: number })
      case 'TRAIL_HOVER':          return this.setTrailHover(cmd.trailId)
      case 'TRAIL_SELECT':         return cmd.trailId === null ? this.deselectTrail() : this.selectTrail(cmd.trailId)
      case 'START_FLY_ALONG':      return this.startFlyAlong(cmd.trailId)
      case 'STOP_FLY_ALONG':       return this.stopFlyAlong({ restoreCamera: cmd.restoreCamera })
      case 'UPDATE_GEOJSON':       break
      case 'ADD_LAYER':            break
      case 'REMOVE_LAYER':         break
      case 'SET_LAYER_VISIBILITY': break
      default: {
        const _exhaustive: never = cmd
        console.warn('Unhandled MapCommand', _exhaustive)
      }
    }
  }

  // Search parks by name across all loaded tiles. Results are limited to
  // features that have been fetched into the tile cache (i.e. the current view).
  searchParks(query: string): ParkSearchResult[] {
    if (query.length < 2) return []

    const q = query.toLowerCase()
    const seen = new Set<string | number>()
    const results: ParkSearchResult[] = []

    const features = this.map.querySourceFeatures('national-parks', { sourceLayer: SOURCE_LAYER })

    for (const feature of features) {
      const props = feature.properties as HoveredFeatureProperties
      const id = props.SITE_PID ?? props.NAME ?? ''
      if (seen.has(id)) continue

      const name = String(props.NAME || props.NAME_ENG || '')
      if (!name.toLowerCase().includes(q)) continue

      seen.add(id)
      results.push({
        name,
        iso3: String(props.ISO3 ?? ''),
        designation: String(props.DESIG_TYPE ?? ''),
        properties: props,
        bounds: getBoundsFromGeometry(feature.geometry as GeoJSON.Geometry),
      })

      if (results.length >= 10) break
    }

    return results.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(q)
      const bStarts = b.name.toLowerCase().startsWith(q)
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1
      return a.name.localeCompare(b.name)
    })
  }

  private handleBasemapChange(basemapId: string): void {
    const basemap = BASEMAP_OPTIONS.find(b => b.id === basemapId)
    if (!basemap) return

    // A live tour has a RAF loop spinning on the soon-to-be-gone style; sync
    // Redux so the panel UI flips back to "Full details". The selection
    // (mask + satellite) survives the swap — we re-apply it after style.load
    // so the user keeps their context.
    if (this.tourSiteId !== null) {
      this.stopTour({ restoreCamera: false })
      this.store.dispatch(setTourActive(false))
    }

    // `setStyle()` nukes the satellite/mask layers from the live style but
    // preserves our `selectedSiteId` / `preSelectionCamera` so the post-load
    // re-apply path can restore the overlay (and the close action still
    // reverts to the user's original camera).
    const previouslySelected = this.selectedSiteId
    this.removeSelectionLayers()
    this.cancelSelectionRetry()

    this.currentBasemapId = basemapId
    this.currentAugmentation = null

    const style = basemap.style === null
      ? buildCustomMapStyle(this.getEffectivePalette())
      : basemap.style

    this.styleReady = false
    this.map.setStyle(style)
    this.map.once('style.load', () => {
      this.styleReady = true
      // Mapbox-hosted styles can declare their own projection in style JSON,
      // which would clobber globe on every basemap swap. Reapply imperatively
      // after the new style settles.
      this.map.setProjection('globe')
      this.addDataLayers()

      // Re-apply selection overlay on the fresh style. `selectPark` is
      // idempotent for the same id — it skips the camera save + fitBounds
      // and just re-paints the feature-state + satellite/mask.
      if (previouslySelected !== null) {
        this.selectPark(previouslySelected)
      }
    })
  }

  private getEffectivePalette() {
    const s = this.store.getState().mapStyle
    return getEffectivePalette(getUiTheme(s.selectedUiTheme), s.uiMode)
  }

  private handleUiThemeChange(themeId: string): void {
    const palette = getEffectivePalette(getUiTheme(themeId), this.store.getState().mapStyle.uiMode)
    applyUiTheme(palette)

    // Style hasn't finished its first/next load yet — `addDataLayers` runs on
    // `'load'` / `'style.load'` and re-reads the live theme, so this change
    // will be picked up automatically once the style settles.
    if (!this.styleReady) return

    // Atmosphere/space — fog is a map-level property, no style reload needed.
    applyMapFog(this.map, palette)

    // NOTE: deliberately not gated by `map.isStyleLoaded()` — that returns
    // false while *any* source (PMTiles, DEM tiles) is streaming, even though
    // `setPaintProperty` works fine in that state. Per-layer `getLayer`
    // guards keep us safe if a particular layer isn't in the active style.
    if (this.currentBasemapId === CUSTOM_BASEMAP_ID) {
      for (const { layerId, property, value } of getCustomLayerPaints(palette)) {
        if (this.map.getLayer(layerId)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          this.map.setPaintProperty(layerId, property as any, value)
        }
      }
    }

  }

  private addDataLayers(): void {
    if (!this.map.getLayer('sky')) {
      this.map.addLayer({
        id: 'sky',
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0.0, 90.0],
          'sky-atmosphere-sun-intensity': 15,
        },
      })
    }

    // Single source of truth for syncing the live style to the active UI
    // theme. Runs on initial 'load' AND every 'style.load' after a basemap
    // swap, so any UI-theme change that happened while the style was still
    // loading (and was therefore skipped by `handleUiThemeChange`'s
    // `isStyleLoaded()` guard) gets reconciled here.
    const palette = this.getEffectivePalette()

    // Atmosphere/space — repaint regardless of basemap.
    applyMapFog(this.map, palette)

    // Custom-earth basemap layers were baked from the palette captured at
    // `setStyle()` time. Re-apply with the *current* palette so any drift
    // (initial-mount race, mid-swap UI theme change, etc.) is corrected.
    if (this.currentBasemapId === CUSTOM_BASEMAP_ID) {
      for (const { layerId, property, value } of getCustomLayerPaints(palette)) {
        if (this.map.getLayer(layerId)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          this.map.setPaintProperty(layerId, property as any, value)
        }
      }
    }

    this.reconcile(selectAugmentationSpec(this.store.getState()))
  }

  private reconcile(next: AugmentationSpec): void {
    if (!this.currentAugmentation) {
      for (const [id, source] of Object.entries(next.sources)) {
        if (!this.map.getSource(id)) this.map.addSource(id, source as mapboxgl.AnySourceData)
      }
      if (next.terrain) this.map.setTerrain(next.terrain)
      for (const layer of next.layers) {
        if (!this.map.getLayer(layer.id)) this.map.addLayer(layer as mapboxgl.AnyLayer)
      }
    } else {
      const ops = diff(
        { glyphs: '', ...this.currentAugmentation },
        { glyphs: '', ...next }
      )
      for (const op of ops) this.applyOperation(op)
    }
    this.currentAugmentation = next
  }

  private applyOperation(op: { command: string; args: unknown[] }): void {
    const m = this.map
    const [a0, a1, a2] = op.args

    switch (op.command) {
      case 'setPaintProperty':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        m.setPaintProperty(a0 as string, a1 as any, a2)
        break
      case 'setLayoutProperty':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        m.setLayoutProperty(a0 as string, a1 as any, a2)
        break
      case 'setFilter':
        m.setFilter(a0 as string, a1 as mapboxgl.FilterSpecification | null)
        break
      case 'setTerrain':
        m.setTerrain((a0 as mapboxgl.TerrainSpecification) ?? null)
        break
      case 'addLayer':
        if (!m.getLayer((a0 as mapboxgl.AnyLayer).id)) {
          m.addLayer(a0 as mapboxgl.AnyLayer, (a1 as string) ?? undefined)
        }
        break
      case 'removeLayer':
        if (m.getLayer(a0 as string)) m.removeLayer(a0 as string)
        break
      case 'addSource':
        if (!m.getSource(a0 as string)) m.addSource(a0 as string, a1 as mapboxgl.AnySourceData)
        break
      case 'removeSource':
        if (m.getSource(a0 as string)) m.removeSource(a0 as string)
        break
      case 'setLayerZoomRange':
        m.setLayerZoomRange(a0 as string, a1 as number, a2 as number)
        break
    }
  }

  private registerMapEvents(): void {
    // Hover: highlight + show name in legend panel
    this.map.on('mousemove', 'parks-fill', (e) => {
      this.map.getCanvas().style.cursor = 'pointer'
      if (!e.features?.length) return

      const feature = e.features[0]
      const id = feature.id

      if (this.hoveredId !== null && this.hoveredId !== id) {
        this.map.setFeatureState(
          { source: 'national-parks', sourceLayer: SOURCE_LAYER, id: this.hoveredId },
          { hover: false }
        )
      }

      if (id !== undefined) {
        this.hoveredId = id
        this.map.setFeatureState(
          { source: 'national-parks', sourceLayer: SOURCE_LAYER, id },
          { hover: true }
        )
      }

      this.store.dispatch(setHoveredFeature(feature.properties as HoveredFeatureProperties))
    })

    this.map.on('mouseleave', 'parks-fill', () => {
      this.map.getCanvas().style.cursor = ''

      if (this.hoveredId !== null) {
        this.map.setFeatureState(
          { source: 'national-parks', sourceLayer: SOURCE_LAYER, id: this.hoveredId },
          { hover: false }
        )
        this.hoveredId = null
      }

      this.store.dispatch(setHoveredFeature(null))
    })

    // Trail hover: highlight + cursor change. Layer ids may not exist in
    // the live style yet (trails toggle), so guard each event registration.
    // Hover state lives on whichever source actually has the feature; the
    // helper inside `setTrailHover` handles the dispatch.
    this.map.on('mousemove', (e) => {
      const trailLayers = TRAIL_INTERACTIVE_LAYERS.filter(id => this.map.getLayer(id))
      if (trailLayers.length === 0) return
      const hits = this.map.queryRenderedFeatures(e.point, { layers: trailLayers })
      if (hits.length > 0) {
        const id = hits[0].id
        if (id !== undefined) {
          this.map.getCanvas().style.cursor = 'pointer'
          this.setTrailHover(id)
          this.store.dispatch(setHoveredTrail(id))
        }
      } else if (this.hoveredTrailId !== null) {
        this.setTrailHover(null)
        this.store.dispatch(setHoveredTrail(null))
      }
    })

    // Click: trails take routing priority over parks because the line-width
    // hit target is much narrower than the park polygon — a click that
    // hits both is overwhelmingly meant for the trail.
    //
    // Trail click DOES NOT clear the park selection: the most interesting
    // case is a trail inside an already-selected park (Wonderland inside
    // Mt Rainier), and both panels are designed to stack vertically. Park
    // click DOES clear the trail (the user moved their attention to a
    // different park polygon, the trail is no longer in context).
    //
    // The selection listeners (registerListeners) route the resulting
    // state changes into `engine.selectPark` / `engine.selectTrail`.
    this.map.on('click', (e) => {
      const trailLayers = TRAIL_INTERACTIVE_LAYERS.filter(id => this.map.getLayer(id))
      const bbox: [mapboxgl.PointLike, mapboxgl.PointLike] = [
        [e.point.x - 6, e.point.y - 6],
        [e.point.x + 6, e.point.y + 6],
      ]
      const trailHits = trailLayers.length > 0
        ? this.map.queryRenderedFeatures(bbox, { layers: trailLayers })
        : []
      const parkHits = this.map.queryRenderedFeatures(e.point, { layers: ['parks-fill'] })

      // Resolve trail: take the first hit with a usable id.
      let trailDispatched = false
      for (const f of trailHits) {
        const id = f.id ?? (f.properties as { osm_id?: string | number })?.osm_id
        if (id !== undefined && id !== null) {
          this.store.dispatch(setSelectedTrail({ id, props: f.properties as TrailProperties }))
          trailDispatched = true
          break
        }
      }

      // Resolve park: select if hit, clear if not (but don't clear trail on a
      // trail-only click — the tab panel handles both being open at once).
      if (parkHits.length > 0) {
        this.store.dispatch(setSelectedFeature(parkHits[0].properties as HoveredFeatureProperties))
      } else if (trailDispatched) {
        // Trail-only click: leave park selection as-is so a trail inside an
        // already-selected park keeps the park tab available.
      } else {
        this.store.dispatch(setSelectedFeature(null))
        this.store.dispatch(setSelectedTrail(null))
      }
    })

    this.map.on('moveend', () => {
      const { lng, lat } = this.map.getCenter()
      this.store.dispatch(cameraObserved({
        center: [lng, lat],
        zoom: this.map.getZoom(),
        bearing: this.map.getBearing(),
        pitch: this.map.getPitch(),
      }))
    })
  }
}
