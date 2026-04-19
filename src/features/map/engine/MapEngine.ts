import mapboxgl from 'mapbox-gl'
// Have Vite bundle Mapbox's worker as a real module (with a stable URL it
// controls) instead of letting Mapbox stringify + Blob-URL its inlined worker
// source. The blob path picks up Vite's dev-mode HMR helpers (e.g.
// `__vite__injectQuery`) which then crash inside the worker context where
// those helpers don't exist. Same workaround documented in
// https://github.com/mapbox/mapbox-gl-js/issues/12656.
import MapboxWorker from 'mapbox-gl/dist/mapbox-gl-csp-worker?worker'
import { diff } from '@mapbox/mapbox-gl-style-spec'

;(mapboxgl as unknown as { workerClass: typeof Worker }).workerClass = MapboxWorker as unknown as typeof Worker
import type { AppStore } from '../../../app/store'
import { setHoveredFeature, setSelectedFeature, setTourActive } from '../../parks/interactionSlice'
import { cameraObserved } from '../cameraSlice'
import type { HoveredFeatureProperties, ParkSearchResult } from '../../../shared/types'
import { BASEMAP_OPTIONS } from '../../../shared/constants/basemaps'
import { getUiTheme, getEffectivePalette, applyUiTheme, applyMapFog, buildCustomMapStyle, getCustomLayerPaints } from '../../../shared/constants/uiThemes'
import type { MapCommand } from './commands'
import { selectAugmentationSpec, type AugmentationSpec } from './styleAugmentation'
import { stitchSatelliteTiles } from './satelliteTiles'

const SOURCE_LAYER = 'geo'
const CUSTOM_BASEMAP_ID = 'earth'

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

  // ── Tour state (Full detail → orbit on top of selection) ────────────────
  private tourSiteId: string | number | null = null
  private tourRaf: number | null = null
  private tourBearingStart = 0
  private tourStartTs = 0
  // Bearing/pitch captured when the orbit starts so we can restore the camera
  // when the tour ends programmatically (Show less / panel close).
  private preTourCamera: { bearing: number; pitch: number } | null = null

  constructor(container: HTMLDivElement, store: AppStore) {
    this.store = store
    const state = store.getState()

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || ''

    const initialBasemap = BASEMAP_OPTIONS.find(b => b.id === state.mapStyle.selectedBasemap) ?? BASEMAP_OPTIONS[0]
    this.currentBasemapId = initialBasemap.id

    const initialStyle = initialBasemap.style === null
      ? buildCustomMapStyle(getUiTheme(state.mapStyle.selectedUiTheme).palette)
      : initialBasemap.style

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
  }

  getMap(): mapboxgl.Map {
    return this.map
  }

  destroy(): void {
    this.stopTour({ restoreCamera: false })
    this.clearSelectionOverlay()
    this.map.remove()
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

  execute(cmd: MapCommand): void {
    switch (cmd.type) {
      case 'STYLE_RECONCILE':      return this.reconcile(cmd.spec)
      case 'BASEMAP_CHANGE':       return this.handleBasemapChange(cmd.basemapId)
      case 'UI_THEME_CHANGE':      return this.handleUiThemeChange(cmd.themeId)
      case 'FLY_TO':               return void this.map.flyTo(cmd.options as mapboxgl.EasingOptions)
      case 'FIT_BOUNDS':           return void this.map.fitBounds(cmd.bounds, cmd.options)
      case 'EASE_TO':              return void this.map.easeTo(cmd.options as mapboxgl.EasingOptions & { duration?: number })
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

    // Click: open detail panel. The selection listener (registerListeners)
    // routes the resulting state change into `engine.selectPark`, which owns
    // both the satellite/mask overlay and the camera framing.
    this.map.on('click', (e) => {
      const features = this.map.queryRenderedFeatures(e.point, { layers: ['parks-fill'] })

      if (features.length > 0) {
        const feature = features[0]
        const props = feature.properties as HoveredFeatureProperties
        this.store.dispatch(setSelectedFeature(props))
      } else {
        this.store.dispatch(setSelectedFeature(null))
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
