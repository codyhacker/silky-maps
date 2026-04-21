import type {
  Map as MapboxMap,
  AnySourceData,
  AnyLayer,
  FilterSpecification,
  TerrainSpecification,
} from 'mapbox-gl'
import { diff } from '@mapbox/mapbox-gl-style-spec'
import type { AppStore } from '../../../app/store'
import { BASEMAP_OPTIONS } from '../../../shared/constants/basemaps'
import { getUiTheme, getEffectivePalette, applyUiTheme, applyMapFog, buildCustomMapStyle, getCustomLayerPaints } from '../../../shared/constants/uiThemes'
import { selectAugmentationSpec, type AugmentationSpec } from './styleAugmentation'
import type { ParkController } from './ParkController'

const CUSTOM_BASEMAP_ID = 'earth'

export class StyleController {
  private map: MapboxMap
  private store: AppStore
  private parks: ParkController
  private currentAugmentation: AugmentationSpec | null = null
  private currentBasemapId: string

  // True once the very first 'load' has fired (and reset/restored on every
  // basemap swap). Used in place of `map.isStyleLoaded()` because the latter
  // can return false long after the style is actually usable.
  private styleReady = false

  constructor(map: MapboxMap, store: AppStore, parks: ParkController, initialBasemapId: string) {
    this.map = map
    this.store = store
    this.parks = parks
    this.currentBasemapId = initialBasemapId

    this.map.on('load', () => {
      this.styleReady = true
      this.addDataLayers()
    })
  }

  execute(cmd:
    | { type: 'STYLE_RECONCILE'; spec: AugmentationSpec }
    | { type: 'BASEMAP_CHANGE'; basemapId: string }
    | { type: 'UI_THEME_CHANGE'; themeId: string }
  ): void {
    switch (cmd.type) {
      case 'STYLE_RECONCILE': return this.reconcile(cmd.spec)
      case 'BASEMAP_CHANGE':  return this.handleBasemapChange(cmd.basemapId)
      case 'UI_THEME_CHANGE': return this.handleUiThemeChange(cmd.themeId)
    }
  }

  private handleBasemapChange(basemapId: string): void {
    const basemap = BASEMAP_OPTIONS.find(b => b.id === basemapId)
    if (!basemap) return

    this.parks.onBasemapAboutToSwap()

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
      // which would clobber globe on every basemap swap. Reapply imperatively.
      this.map.setProjection('globe')
      this.addDataLayers()
      this.parks.onBasemapLoaded()
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
    // 'load' / 'style.load' and re-reads the live theme, so this change will
    // be picked up automatically once the style settles.
    if (!this.styleReady) return

    applyMapFog(this.map, palette)

    // NOTE: deliberately not gated by `map.isStyleLoaded()` — that returns
    // false while *any* source (PMTiles, DEM tiles) is streaming, even though
    // `setPaintProperty` works fine in that state.
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
    // `styleReady` guard) gets reconciled here.
    const palette = this.getEffectivePalette()

    applyMapFog(this.map, palette)

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
        if (!this.map.getSource(id)) this.map.addSource(id, source as AnySourceData)
      }
      if (next.terrain) this.map.setTerrain(next.terrain)
      for (const layer of next.layers) {
        if (!this.map.getLayer(layer.id)) this.map.addLayer(layer as AnyLayer)
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
        m.setFilter(a0 as string, a1 as FilterSpecification | null)
        break
      case 'setTerrain':
        m.setTerrain((a0 as TerrainSpecification) ?? null)
        break
      case 'addLayer':
        if (!m.getLayer((a0 as AnyLayer).id)) {
          m.addLayer(a0 as AnyLayer, (a1 as string) ?? undefined)
        }
        break
      case 'removeLayer':
        if (m.getLayer(a0 as string)) m.removeLayer(a0 as string)
        break
      case 'addSource':
        if (!m.getSource(a0 as string)) m.addSource(a0 as string, a1 as AnySourceData)
        break
      case 'removeSource':
        if (m.getSource(a0 as string)) m.removeSource(a0 as string)
        break
      case 'setLayerZoomRange':
        m.setLayerZoomRange(a0 as string, a1 as number, a2 as number)
        break
    }
  }
}
