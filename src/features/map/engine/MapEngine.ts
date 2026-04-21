import mapboxgl from 'mapbox-gl'
// Have Vite bundle Mapbox's worker as a real module (with a stable URL it
// controls) instead of letting Mapbox stringify + Blob-URL its inlined worker
// source. The blob path picks up Vite's dev-mode HMR helpers (e.g.
// `__vite__injectQuery`) which then crash inside the worker context where
// those helpers don't exist. Same workaround documented in
// https://github.com/mapbox/mapbox-gl-js/issues/12656.
import MapboxWorker from 'mapbox-gl/dist/mapbox-gl-csp-worker?worker'

;(mapboxgl as unknown as { workerClass: typeof Worker }).workerClass = MapboxWorker as unknown as typeof Worker
import type { AppStore } from '../../../app/store'
import { setHoveredFeature, setSelectedFeature } from '../../parks/interactionSlice'
import { setHoveredTrail, setSelectedTrail } from '../../trails/interactionSlice'
import { cameraObserved } from '../cameraSlice'
import type { HoveredFeatureProperties, ParkSearchResult, TrailProperties } from '../../../shared/types'
import { BASEMAP_OPTIONS } from '../../../shared/constants/basemaps'
import { getUiTheme, getEffectivePalette, applyUiTheme, buildCustomMapStyle } from '../../../shared/constants/uiThemes'
import type { MapCommand } from './commands'
import { StyleController } from './StyleController'
import { ParkController } from './ParkController'
import { TrailController } from './TrailController'

// Trail layers we route clicks through (in priority order — primary before
// casing so the wider hit-target doesn't shadow the actual line).
const TRAIL_INTERACTIVE_LAYERS = ['trails-primary', 'trails-thru']

export class MapEngine {
  private map: mapboxgl.Map
  private store: AppStore
  private hoveredId: string | number | null = null

  private style: StyleController
  private parks: ParkController
  private trails: TrailController

  constructor(container: HTMLDivElement, store: AppStore) {
    this.store = store
    const state = store.getState()

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || ''

    const initialBasemap = BASEMAP_OPTIONS.find(b => b.id === state.mapStyle.selectedBasemap) ?? BASEMAP_OPTIONS[0]
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

    // Build park controller first so StyleController can reach into it for
    // basemap-swap coordination (overlay teardown + reapply).
    this.parks = new ParkController(this.map, store)
    this.trails = new TrailController(this.map, store)
    this.style = new StyleController(this.map, store, this.parks, initialBasemap.id)

    this.registerMapEvents()

    if (import.meta.env.DEV) {
      ;(window as unknown as { __engine?: MapEngine; __store?: AppStore }).__engine = this
      ;(window as unknown as { __engine?: MapEngine; __store?: AppStore }).__store = store
    }
  }

  getMap(): mapboxgl.Map {
    return this.map
  }

  whenWdpaReady(cb: () => void): void {
    this.parks.whenWdpaReady(cb)
  }

  destroy(): void {
    this.trails.destroy()
    this.parks.destroy()
    this.map.remove()
  }

  // ─── Query methods ───────────────────────────────────────────────────────
  // Commands mutate; queries return values synchronously. Kept as direct
  // methods so callers don't have to plumb a result channel through execute().

  searchParks(query: string): ParkSearchResult[] { return this.parks.searchParks(query) }
  getSelectedTrailProfile(samples = 60) { return this.trails.getSelectedTrailProfile(samples) }

  // ─── Command dispatcher ──────────────────────────────────────────────────

  execute(cmd: MapCommand): void {
    switch (cmd.type) {
      case 'STYLE_RECONCILE':
      case 'BASEMAP_CHANGE':
      case 'UI_THEME_CHANGE':
        return this.style.execute(cmd)
      case 'FLY_TO':               return void this.map.flyTo(cmd.options as mapboxgl.EasingOptions)
      case 'FIT_BOUNDS':           return void this.map.fitBounds(cmd.bounds, cmd.options)
      case 'EASE_TO':              return void this.map.easeTo(cmd.options as mapboxgl.EasingOptions & { duration?: number })
      case 'PARK_SELECT':          return this.parks.selectPark(cmd.siteId)
      case 'PARK_DESELECT':        return this.parks.deselectPark()
      case 'PARK_TOUR_START':      return this.parks.startTour(cmd.siteId)
      case 'PARK_TOUR_STOP':       return this.parks.stopTour({ restoreCamera: cmd.restoreCamera })
      case 'RESOLVE_PARK_BY_ID':   return this.parks.resolveAndSelectPark(cmd.id)
      case 'TRAIL_HOVER':          return this.trails.setTrailHover(cmd.trailId)
      case 'TRAIL_SELECT':         return cmd.trailId === null ? this.trails.deselectTrail() : this.trails.selectTrail(cmd.trailId)
      case 'START_FLY_ALONG':      return this.trails.startFlyAlong(cmd.trailId)
      case 'STOP_FLY_ALONG':       return this.trails.stopFlyAlong({ restoreCamera: cmd.restoreCamera })
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

  // ─── DOM-level map events (dispatch Redux, don't touch controllers) ──────

  private registerMapEvents(): void {
    // Park hover
    this.map.on('mousemove', 'parks-fill', (e) => {
      this.map.getCanvas().style.cursor = 'pointer'
      if (!e.features?.length) return

      const feature = e.features[0]
      const id = feature.id

      if (this.hoveredId !== null && this.hoveredId !== id) {
        this.map.setFeatureState(
          { source: 'national-parks', sourceLayer: 'geo', id: this.hoveredId },
          { hover: false }
        )
      }

      if (id !== undefined) {
        this.hoveredId = id
        this.map.setFeatureState(
          { source: 'national-parks', sourceLayer: 'geo', id },
          { hover: true }
        )
      }

      this.store.dispatch(setHoveredFeature(feature.properties as HoveredFeatureProperties))
    })

    this.map.on('mouseleave', 'parks-fill', () => {
      this.map.getCanvas().style.cursor = ''

      if (this.hoveredId !== null) {
        this.map.setFeatureState(
          { source: 'national-parks', sourceLayer: 'geo', id: this.hoveredId },
          { hover: false }
        )
        this.hoveredId = null
      }

      this.store.dispatch(setHoveredFeature(null))
    })

    // Trail hover — layer ids may not exist in the live style yet (trails
    // toggle), so guard each registration.
    this.map.on('mousemove', (e) => {
      const trailLayers = TRAIL_INTERACTIVE_LAYERS.filter(id => this.map.getLayer(id))
      if (trailLayers.length === 0) return
      const hits = this.map.queryRenderedFeatures(e.point, { layers: trailLayers })
      if (hits.length > 0) {
        const id = hits[0].id
        if (id !== undefined) {
          this.map.getCanvas().style.cursor = 'pointer'
          this.trails.setTrailHover(id)
          this.store.dispatch(setHoveredTrail(id))
        }
      } else if (this.store.getState().trailsInteraction.hoveredTrailId !== null) {
        this.trails.setTrailHover(null)
        this.store.dispatch(setHoveredTrail(null))
      }
    })

    // Click: trails take routing priority over parks because the line-width
    // hit target is much narrower than the park polygon. Trail click does NOT
    // clear the park selection (trail-inside-park is the canonical case and
    // DetailPanel surfaces the second as a tab). Park click DOES clear the trail.
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

      let trailDispatched = false
      for (const f of trailHits) {
        const id = f.id ?? (f.properties as { osm_id?: string | number })?.osm_id
        if (id !== undefined && id !== null) {
          this.store.dispatch(setSelectedTrail({ id, props: f.properties as TrailProperties }))
          trailDispatched = true
          break
        }
      }

      if (parkHits.length > 0) {
        this.store.dispatch(setSelectedFeature(parkHits[0].properties as HoveredFeatureProperties))
      } else if (trailDispatched) {
        // Trail-only click: leave park selection as-is.
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
