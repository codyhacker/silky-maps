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
import { cameraObserved } from '../cameraSlice'
import type { ParkSearchResult } from '../../../shared/types'
import { BASEMAP_OPTIONS } from '../../../shared/constants/basemaps'
import { getUiTheme, getEffectivePalette, applyUiTheme, buildCustomMapStyle } from '../../../shared/constants/uiThemes'
import type { MapCommand } from './commands'
import { StyleController } from './StyleController'
import { ParkController } from './ParkController'
import { TrailController } from './TrailController'
import { registerPointerRouter } from './pointer/registerPointerRouter'
import { parksLayer } from './pointer/layers/parks'
import { trailsLayer } from './pointer/layers/trails'

export class MapEngine {
  private map: mapboxgl.Map
  private store: AppStore

  private style: StyleController
  private parks: ParkController
  private trails: TrailController
  private unsubPointer: () => void

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

    this.unsubPointer = registerPointerRouter(this.map, store, [parksLayer, trailsLayer])

    this.map.on('moveend', () => {
      const { lng, lat } = this.map.getCenter()
      this.store.dispatch(cameraObserved({
        center: [lng, lat],
        zoom: this.map.getZoom(),
        bearing: this.map.getBearing(),
        pitch: this.map.getPitch(),
      }))
    })

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
    this.unsubPointer()
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

}
