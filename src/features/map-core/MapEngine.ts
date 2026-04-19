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
import type { AppStore } from '../../app/store'
import { setHoveredFeature, setSelectedFeature, cameraObserved } from './mapInteractionSlice'
import { fitBounds } from './commandedCameraSlice'
import type { HoveredFeatureProperties, ParkSearchResult } from '../../shared/types'
import { BASEMAP_OPTIONS } from '../../shared/constants/basemaps'
import { getUiTheme, applyUiTheme, buildCustomMapStyle, getCustomLayerPaints } from '../../shared/constants/uiThemes'
import type { MapCommand } from './mapCommands'
import { selectAugmentationSpec, type AugmentationSpec } from './styleAugmentation'

const SOURCE_LAYER = 'geo'
const CUSTOM_BASEMAP_ID = 'earth'

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
      zoom: 3.5,
      pitch: 30,
      bearing: 0,
      attributionControl: false,
    })

    this.map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    this.map.addControl(new mapboxgl.FullscreenControl(), 'top-right')

    this.map.on('load', () => this.addDataLayers())
    this.registerMapEvents()
  }

  getMap(): mapboxgl.Map {
    return this.map
  }

  destroy(): void {
    this.map.remove()
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

    this.currentBasemapId = basemapId
    this.currentAugmentation = null

    const style = basemap.style === null
      ? buildCustomMapStyle(getUiTheme(this.store.getState().mapStyle.selectedUiTheme).palette)
      : basemap.style

    this.map.setStyle(style)
    this.map.once('style.load', () => this.addDataLayers())
  }

  private handleUiThemeChange(themeId: string): void {
    const theme = getUiTheme(themeId)
    applyUiTheme(theme)

    if (this.currentBasemapId === CUSTOM_BASEMAP_ID && this.map.isStyleLoaded()) {
      for (const { layerId, property, value } of getCustomLayerPaints(theme.palette)) {
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
