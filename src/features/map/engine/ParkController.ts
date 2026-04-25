import mapboxgl from 'mapbox-gl'
import type { AppStore } from '../../../app/store'
import { setSelectedFeature, setPendingParkId, setTourActive } from '../../parks/interactionSlice'
import type { HoveredFeatureProperties, ParkSearchResult } from '../../../shared/types'
import { stitchSatelliteTiles } from './satelliteTiles'
import { getBoundsFromGeometry, mobileFitPadding, type CameraSnapshot } from './geometry'

const SOURCE_LAYER = 'geo'

// Selection overlay — Mapbox satellite tiles, polygon-clipped at canvas
// stitch time so the resulting image already has transparent edges that
// match the park silhouette exactly.
const SEL_SATELLITE_SRC_ID = 'selection-satellite-src'
const SEL_SATELLITE_LAYER_ID = 'selection-satellite'

export class ParkController {
  private map: mapboxgl.Map
  private store: AppStore

  // ── Selection state (click → mask + satellite overlay) ──────────────────
  private selectedSiteId: string | number | null = null
  private preSelectionCamera: CameraSnapshot | null = null
  private preSelectionGestureHandler: ((e: { originalEvent?: Event }) => void) | null = null
  private selectionRetry: ((e: { sourceId?: string }) => void) | null = null
  private satelliteAbort: AbortController | null = null
  private satelliteBlobUrl: string | null = null

  // ── Pending park id (deep-link restoration) ─────────────────────────────
  private pendingParkRetry: ((e: { sourceId?: string }) => void) | null = null

  // ── Tour state (Full detail → orbit on top of selection) ────────────────
  private tourSiteId: string | number | null = null
  private tourRaf: number | null = null
  private tourBearingStart = 0
  private tourStartTs = 0
  private preTourCamera: { bearing: number; pitch: number } | null = null

  constructor(map: mapboxgl.Map, store: AppStore) {
    this.map = map
    this.store = store
  }

  destroy(): void {
    this.stopTour({ restoreCamera: false })
    this.clearSelectionOverlay()
  }

  // ─── Basemap-swap coordination (called by StyleController) ──────────────

  // Invoked before setStyle(). Preserves `selectedSiteId` + `preSelectionCamera`
  // so the overlay can be re-applied on the fresh style; close still reverts
  // to the user's original pre-selection view.
  onBasemapAboutToSwap(): void {
    if (this.tourSiteId !== null) {
      this.stopTour({ restoreCamera: false })
      this.store.dispatch(setTourActive(false))
    }
    this.removeSelectionLayers()
    this.cancelSelectionRetry()
  }

  // Invoked after style.load. If a park was selected pre-swap, re-apply the
  // overlay — selectPark is idempotent for the same id (skips camera save +
  // fitBounds, just repaints feature-state + satellite/mask).
  onBasemapLoaded(): void {
    if (this.selectedSiteId !== null) {
      this.selectPark(this.selectedSiteId)
    }
  }

  // ─── Park source-readiness helper ───────────────────────────────────────

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

  // ─── Selection: click → mask + satellite overlay ────────────────────────

  selectPark(siteId: string | number): void {
    const reapplying = this.selectedSiteId === siteId

    if (!reapplying && this.selectedSiteId !== null) {
      this.stopTour({ restoreCamera: false })
      this.clearSelectionOverlayLayers()
    }

    this.cancelSelectionRetry()

    if (!reapplying) {
      const c = this.map.getCenter()
      if (!this.preSelectionCamera) {
        this.preSelectionCamera = {
          center: [c.lng, c.lat],
          zoom: this.map.getZoom(),
          bearing: this.map.getBearing(),
          pitch: this.map.getPitch(),
        }
        // If the user navigates away after selecting, drop the snapshot so
        // closing the panel doesn't snap them back to where they were before
        // they ever clicked. Same gesture-detection trick as the tour.
        this.attachPreSelectionGestureListeners()
      }
      this.selectedSiteId = siteId
    }

    const result = this.getFeatureBoundsAndGeometry(siteId)
    if (!result) {
      this.scheduleSelectionRetry(siteId)
      return
    }

    this.applySelectionOverlay(siteId, result.bounds, result.geometry)

    if (!reapplying) {
      this.map.fitBounds(result.bounds, {
        padding: mobileFitPadding({ right: 60 }),
        maxZoom: 10,
        duration: 1200,
      })
    }
  }

  deselectPark(): void {
    this.stopTour({ restoreCamera: false })
    this.clearSelectionOverlay()
    this.detachPreSelectionGestureListeners()

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

  private attachPreSelectionGestureListeners(): void {
    this.detachPreSelectionGestureListeners()
    const handler = (e: { originalEvent?: Event }): void => {
      // Programmatic moves (fitBounds, easeTo) fire these too — ignore them.
      if (!e.originalEvent) return
      this.preSelectionCamera = null
      this.detachPreSelectionGestureListeners()
    }
    this.preSelectionGestureHandler = handler
    this.map.on('dragstart', handler)
    this.map.on('rotatestart', handler)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.map.on('zoomstart', handler as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.map.on('pitchstart', handler as any)
  }

  private detachPreSelectionGestureListeners(): void {
    const h = this.preSelectionGestureHandler
    if (!h) return
    this.map.off('dragstart', h)
    this.map.off('rotatestart', h)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.map.off('zoomstart', h as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.map.off('pitchstart', h as any)
    this.preSelectionGestureHandler = null
  }

  private clearSelectionOverlay(): void {
    this.cancelSelectionRetry()
    this.clearSelectionOverlayLayers()
    this.detachPreSelectionGestureListeners()
    this.selectedSiteId = null
  }

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
      if (this.selectedSiteId !== siteId) {
        this.cancelSelectionRetry()
        return
      }
      const result = this.getFeatureBoundsAndGeometry(siteId)
      if (!result) return
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
    void this.addSelectionSatellite(siteId, bounds, geometry)
  }

  private async addSelectionSatellite(
    forSiteId: string | number,
    bounds: [[number, number], [number, number]],
    geometry: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
  ): Promise<void> {
    if (this.map.getSource(SEL_SATELLITE_SRC_ID)) return

    this.satelliteAbort?.abort()
    const abort = new AbortController()
    this.satelliteAbort = abort

    const token = mapboxgl.accessToken ?? ''
    let stitched
    try {
      stitched = await stitchSatelliteTiles(bounds, geometry, token, abort.signal)
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return
      console.warn('[ParkController] satellite tile stitch failed', err)
      if (this.satelliteAbort === abort) this.satelliteAbort = null
      return
    }

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
    this.satelliteAbort?.abort()
    this.satelliteAbort = null

    if (this.map.getLayer(SEL_SATELLITE_LAYER_ID)) {
      this.map.removeLayer(SEL_SATELLITE_LAYER_ID)
    }
    if (this.map.getSource(SEL_SATELLITE_SRC_ID)) {
      this.map.removeSource(SEL_SATELLITE_SRC_ID)
    }

    if (this.satelliteBlobUrl) {
      URL.revokeObjectURL(this.satelliteBlobUrl)
      this.satelliteBlobUrl = null
    }
  }

  // ─── Tour: orbit-around-the-selected-park ────────────────────────────────

  startTour(siteId: string | number): void {
    if (this.selectedSiteId !== siteId) return
    if (this.tourSiteId === siteId) return

    this.stopTour({ restoreCamera: false })

    const result = this.getFeatureBoundsAndGeometry(siteId)
    if (!result) return
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

    const launchSiteId = siteId
    this.map.once('moveend', () => {
      if (this.tourSiteId !== launchSiteId) return
      this.runTourLoop()
    })

    this.map.on('dragstart', this.onUserInteraction)
    this.map.on('rotatestart', this.onUserInteraction)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.map.on('zoomstart', this.onUserInteraction as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.map.on('pitchstart', this.onUserInteraction as any)
  }

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

  private runTourLoop(): void {
    this.tourBearingStart = this.map.getBearing()
    this.tourStartTs = performance.now()

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

  private onUserInteraction = (e: { originalEvent?: Event }): void => {
    if (!e.originalEvent) return
    this.stopTour({ restoreCamera: false })
    this.store.dispatch(setTourActive(false))
  }

  // ─── WDPA geometry lookup ───────────────────────────────────────────────

  private getFeatureBoundsAndGeometry(siteId: string | number): {
    bounds: [[number, number], [number, number]]
    geometry: GeoJSON.Feature<GeoJSON.MultiPolygon>
  } | null {
    const features = this.map.querySourceFeatures('national-parks', {
      sourceLayer: SOURCE_LAYER,
      filter: ['==', ['get', 'SITE_PID'], siteId],
    })

    let bounds: [[number, number], [number, number]] | null = null
    const polygons: number[][][][] = []

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

  // ─── Deep-link restoration ──────────────────────────────────────────────

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

  // ─── Search ─────────────────────────────────────────────────────────────

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
}
