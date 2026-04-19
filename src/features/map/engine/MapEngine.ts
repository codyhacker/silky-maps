import mapboxgl from 'mapbox-gl'
// Have Vite bundle Mapbox's worker as a real module (with a stable URL it
// controls) instead of letting Mapbox stringify + Blob-URL its inlined worker
// source. The blob path picks up Vite's dev-mode HMR helpers (e.g.
// `__vite__injectQuery`) which then crash inside the worker context where
// those helpers don't exist. Same workaround documented in
// https://github.com/mapbox/mapbox-gl-js/issues/12656.
import MapboxWorker from 'mapbox-gl/dist/mapbox-gl-csp-worker?worker'
import { diff } from '@mapbox/mapbox-gl-style-spec'
import mask from '@turf/mask'

;(mapboxgl as unknown as { workerClass: typeof Worker }).workerClass = MapboxWorker as unknown as typeof Worker
import type { AppStore } from '../../../app/store'
import { setHoveredFeature, setSelectedFeature, setTourActive } from '../../parks/interactionSlice'
import { fitBounds, cameraObserved } from '../cameraSlice'
import type { HoveredFeatureProperties, ParkSearchResult } from '../../../shared/types'
import { BASEMAP_OPTIONS } from '../../../shared/constants/basemaps'
import { getUiTheme, applyUiTheme, applyMapFog, buildCustomMapStyle, getCustomLayerPaints } from '../../../shared/constants/uiThemes'
import type { MapCommand } from './commands'
import { selectAugmentationSpec, type AugmentationSpec } from './styleAugmentation'

const SOURCE_LAYER = 'geo'
const CUSTOM_BASEMAP_ID = 'earth'

// Tour overlay — Mapbox satellite tiles scoped to the selected park's bbox,
// PLUS a turf-computed inverse-polygon mask that hides the satellite outside
// the polygon shape. Layer order during a tour:
//   basemap → satellite (bbox-bounded) → mask (bbox − polygon) → parks-fill → parks-outline
// The mask is painted with the active UI theme's `mapBg` so it blends with
// the surrounding custom-earth basemap. On Mapbox-hosted basemaps the mask
// will read as a flat themed ring within the bbox — acceptable trade-off
// since strict polygon clipping requires this opaque cover.
const TOUR_SATELLITE_SRC_ID = 'tour-satellite-src'
const TOUR_SATELLITE_LAYER_ID = 'tour-satellite'
const TOUR_MASK_SRC_ID = 'tour-mask-src'
const TOUR_MASK_LAYER_ID = 'tour-mask'

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

  // ── Tour state ──────────────────────────────────────────────────────────
  // siteId of the park currently being toured (also the id we set the
  // `selected` feature-state on so the layers render outline-only).
  private tourSiteId: string | number | null = null
  private tourRaf: number | null = null
  private tourBearingStart = 0
  private tourStartTs = 0

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

    this.map.addControl(new mapboxgl.NavigationControl(), 'bottom-left')
    this.map.addControl(new mapboxgl.FullscreenControl(), 'bottom-left')

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
    this.stopTour()
    this.map.remove()
  }

  // ─── Tour: orbit-around-the-selected-park ────────────────────────────────

  startTour(siteId: string | number): void {
    // Re-entrant: stop any prior tour first (cleans feature-state + RAF)
    this.stopTour()

    const result = this.getFeatureBoundsAndGeometry(siteId)
    if (!result) {
      // Could happen if the user clicked the panel before tiles for this
      // park are loaded at the current zoom. Bail silently — they can
      // re-toggle once the camera settles.
      return
    }
    const { bounds, geometry } = result

    this.tourSiteId = siteId
    this.map.setFeatureState(
      { source: 'national-parks', sourceLayer: SOURCE_LAYER, id: siteId },
      { selected: true },
    )

    this.addTourSatellite(bounds, geometry)

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

  stopTour(): void {
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
      // Source may be gone if we're tearing down (e.g. during a basemap swap).
      // Guard so we don't throw inside Mapbox internals.
      if (this.map.getSource('national-parks')) {
        this.map.setFeatureState(
          { source: 'national-parks', sourceLayer: SOURCE_LAYER, id: this.tourSiteId },
          { selected: false },
        )
      }
      this.tourSiteId = null
    }

    this.removeTourSatellite()
  }

  // Add a Mapbox satellite raster source bounded to the park's bbox, then add
  // a turf-computed inverse-polygon mask above it so satellite only shows
  // *inside* the polygon shape. Layer order is critical: satellite first
  // (below the mask, above the basemap), mask second (between satellite and
  // parks-fill, hiding satellite outside the polygon).
  private addTourSatellite(
    bounds: [[number, number], [number, number]],
    geometry: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
  ): void {
    if (this.map.getSource(TOUR_SATELLITE_SRC_ID)) return  // re-entrant safety

    const token = mapboxgl.accessToken
    this.map.addSource(TOUR_SATELLITE_SRC_ID, {
      type: 'raster',
      tiles: [
        `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg?access_token=${token}`,
      ],
      tileSize: 256,
      // [west, south, east, north] — Mapbox skips tile requests outside this.
      bounds: [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]],
      attribution: '© Mapbox · DigitalGlobe',
    })

    // Inverse mask = (padded bbox) − park polygon.
    //
    // Mapbox's raster `bounds` only restricts which tiles get *requested* —
    // tiles that intersect the bbox still render all their pixels, so
    // satellite leaks past the strict bbox by up to a tile width. We pad the
    // mask polygon generously to cover that leak. Keeping the satellite
    // source's `bounds` tight (above) means we still don't fetch extra tiles;
    // the pad only affects the cover layer.
    //
    // 50% of the bbox dimension on each side, clamped to at least ~5km
    // (≈0.05°) so small parks still get enough margin to swallow tile-edge
    // pixels at any zoom.
    const padX = Math.max((bounds[1][0] - bounds[0][0]) * 0.5, 0.05)
    const padY = Math.max((bounds[1][1] - bounds[0][1]) * 0.5, 0.05)
    const padded = {
      west:  bounds[0][0] - padX,
      south: bounds[0][1] - padY,
      east:  bounds[1][0] + padX,
      north: bounds[1][1] + padY,
    }
    const bboxPolygon: GeoJSON.Feature<GeoJSON.Polygon> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [padded.west, padded.south],
          [padded.east, padded.south],
          [padded.east, padded.north],
          [padded.west, padded.north],
          [padded.west, padded.south],
        ]],
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inverse = mask(geometry as any, bboxPolygon as any) as GeoJSON.Feature

    this.map.addSource(TOUR_MASK_SRC_ID, {
      type: 'geojson',
      data: inverse,
    })

    // Use the active UI theme's mapBg so the mask blends with the surrounding
    // custom-earth basemap. Mapbox-hosted basemaps will see a flat themed ring
    // within the bbox (see top-of-file note).
    const palette = getUiTheme(this.store.getState().mapStyle.selectedUiTheme).palette

    // `before` anchor: insert both layers below `parks-fill` so other parks
    // and the selected park's outline still render on top of the satellite.
    const before = this.map.getLayer('parks-fill') ? 'parks-fill' : undefined

    this.map.addLayer(
      {
        id: TOUR_SATELLITE_LAYER_ID,
        type: 'raster',
        source: TOUR_SATELLITE_SRC_ID,
        paint: {
          'raster-opacity': 1,
          'raster-fade-duration': 300,
        },
      },
      before,
    )

    // Mask is added *after* satellite with the same `before` anchor, so it
    // ends up immediately above the satellite (and still below parks-fill).
    this.map.addLayer(
      {
        id: TOUR_MASK_LAYER_ID,
        type: 'fill',
        source: TOUR_MASK_SRC_ID,
        paint: {
          'fill-color': palette.mapBg,
          'fill-opacity': 1,
          'fill-antialias': true,
        },
      },
      before,
    )
  }

  private removeTourSatellite(): void {
    if (this.map.getLayer(TOUR_MASK_LAYER_ID)) {
      this.map.removeLayer(TOUR_MASK_LAYER_ID)
    }
    if (this.map.getSource(TOUR_MASK_SRC_ID)) {
      this.map.removeSource(TOUR_MASK_SRC_ID)
    }
    if (this.map.getLayer(TOUR_SATELLITE_LAYER_ID)) {
      this.map.removeLayer(TOUR_SATELLITE_LAYER_ID)
    }
    if (this.map.getSource(TOUR_SATELLITE_SRC_ID)) {
      this.map.removeSource(TOUR_SATELLITE_SRC_ID)
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
  private onUserInteraction = (e: { originalEvent?: Event }): void => {
    if (e.originalEvent) this.stopTour()
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

    // A tour pins satellite/mask layers and `feature-state: selected` onto
    // the live style. `setStyle()` would orphan all of that (RAF still
    // spinning, popup still showing "Show less"). Tear it down cleanly and
    // sync Redux so the panel UI flips back to "Full detail".
    if (this.tourSiteId !== null) {
      this.stopTour()
      this.store.dispatch(setTourActive(false))
    }

    this.currentBasemapId = basemapId
    this.currentAugmentation = null

    const style = basemap.style === null
      ? buildCustomMapStyle(getUiTheme(this.store.getState().mapStyle.selectedUiTheme).palette)
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
    })
  }

  private handleUiThemeChange(themeId: string): void {
    const theme = getUiTheme(themeId)
    applyUiTheme(theme)

    // Style hasn't finished its first/next load yet — `addDataLayers` runs on
    // `'load'` / `'style.load'` and re-reads the live theme, so this change
    // will be picked up automatically once the style settles.
    if (!this.styleReady) return

    // Atmosphere/space — fog is a map-level property, no style reload needed.
    applyMapFog(this.map, theme.palette)

    // NOTE: deliberately not gated by `map.isStyleLoaded()` — that returns
    // false while *any* source (PMTiles, DEM tiles) is streaming, even though
    // `setPaintProperty` works fine in that state. Per-layer `getLayer`
    // guards keep us safe if a particular layer isn't in the active style.
    if (this.currentBasemapId === CUSTOM_BASEMAP_ID) {
      for (const { layerId, property, value } of getCustomLayerPaints(theme.palette)) {
        if (this.map.getLayer(layerId)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          this.map.setPaintProperty(layerId, property as any, value)
        }
      }
    }

    // Tour cutout-around-park is painted with `mapBg` captured at tour-start.
    // Repaint it live so the ring tracks the active theme rather than freezing
    // on whichever theme was active when the tour started.
    if (this.map.getLayer(TOUR_MASK_LAYER_ID)) {
      this.map.setPaintProperty(TOUR_MASK_LAYER_ID, 'fill-color', theme.palette.mapBg)
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
    const palette = getUiTheme(this.store.getState().mapStyle.selectedUiTheme).palette

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

    // Click: open detail panel + fly to park bounds
    this.map.on('click', (e) => {
      const features = this.map.queryRenderedFeatures(e.point, { layers: ['parks-fill'] })

      if (features.length > 0) {
        const feature = features[0]
        const props = feature.properties as HoveredFeatureProperties
        this.store.dispatch(setSelectedFeature(props))

        const bounds = getBoundsFromGeometry(feature.geometry as GeoJSON.Geometry)
        if (bounds) {
          this.store.dispatch(fitBounds({ bounds, padding: 60, maxZoom: 10 }))
        }
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
