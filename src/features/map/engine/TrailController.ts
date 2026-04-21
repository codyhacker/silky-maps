import mapboxgl from 'mapbox-gl'
import along from '@turf/along'
import length from '@turf/length'
import type { AppStore } from '../../../app/store'
import { setFlyAlongActive, setFlyAlongProgress, setFlyAlongPaused } from '../../trails/interactionSlice'
import { getEffectivePalette, getUiTheme } from '../../../shared/constants/uiThemes'
import { getBoundsFromGeometry, computeBearingDeg, mobileFitPadding, type CameraSnapshot } from './geometry'

const TRAILS_SOURCE_LAYER = 'trails'

export class TrailController {
  private map: mapboxgl.Map
  private store: AppStore

  // ── Trail interaction state ─────────────────────────────────────────────
  private hoveredTrailId: string | number | null = null
  private selectedTrailId: string | number | null = null
  private selectedTrailSource: 'trails' | 'thruhikes' | null = null

  // ── Fly-along state ─────────────────────────────────────────────────────
  private preFlyAlongCamera: CameraSnapshot | null = null
  private flyAlongTrailId: string | number | null = null
  private flyAlongRaf: number | null = null
  private flyAlongDurationMs = 0
  private flyAlongLine: GeoJSON.Feature<GeoJSON.LineString> | null = null
  private flyAlongLengthKm = 0
  private flyAlongT = 0
  private flyAlongLastTs: number | null = null
  private flyAlongSmoothedBearing = 0
  private flyAlongMarker: mapboxgl.Marker | null = null

  constructor(map: mapboxgl.Map, store: AppStore) {
    this.map = map
    this.store = store
  }

  destroy(): void {
    this.stopFlyAlong({ restoreCamera: false })
  }

  // ─── Hover + select ─────────────────────────────────────────────────────

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

    const bounds = this.computeBoundsFromFeatures(hits)
    if (bounds) {
      this.map.fitBounds(bounds, {
        // Desktop: right-hand panel is 380px wide; mobile: bottom sheet needs
        // bottom clearance instead.
        padding: mobileFitPadding({ top: 80, right: 380 }),
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

  // ─── Fly-along ──────────────────────────────────────────────────────────

  startFlyAlong(id: string | number): void {
    if (this.selectedTrailId !== id) return
    if (this.flyAlongTrailId === id) return

    this.stopFlyAlong({ restoreCamera: false })

    const line = this.assembleTrailLine(id)
    if (!line || line.geometry.coordinates.length < 2) return

    this.flyAlongTrailId = id
    this.flyAlongLine = line
    this.flyAlongLengthKm = length(line, { units: 'kilometers' })
    this.flyAlongDurationMs = 30_000
    this.flyAlongT = 0
    this.flyAlongLastTs = null
    this.flyAlongSmoothedBearing = this.map.getBearing()

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

    const c = this.map.getCenter()
    this.preFlyAlongCamera = {
      center: [c.lng, c.lat],
      zoom: this.map.getZoom(),
      bearing: this.map.getBearing(),
      pitch: this.map.getPitch(),
    }

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
        this.flyAlongT = trailState.flyAlongProgress
        this.flyAlongLastTs = null
        const distKm = this.flyAlongT * this.flyAlongLengthKm
        const pt = along(this.flyAlongLine, distKm, { units: 'kilometers' })
        this.flyAlongMarker?.setLngLat(pt.geometry.coordinates as [number, number])
        this.flyAlongRaf = requestAnimationFrame(tick)
        return
      }

      if (this.flyAlongLastTs !== null) {
        const dt = now - this.flyAlongLastTs
        this.flyAlongT = Math.min(this.flyAlongT + dt / this.flyAlongDurationMs, 1)
      }
      this.flyAlongLastTs = now

      const distKm = this.flyAlongT * this.flyAlongLengthKm
      const lookAheadKm = Math.min(distKm + 0.15, this.flyAlongLengthKm)
      const pt    = along(this.flyAlongLine, distKm,      { units: 'kilometers' })
      const ahead = along(this.flyAlongLine, lookAheadKm, { units: 'kilometers' })

      const [x1, y1] = pt.geometry.coordinates
      const [x2, y2] = ahead.geometry.coordinates
      const targetBearing = computeBearingDeg([x1, y1], [x2, y2])

      const delta = ((targetBearing - this.flyAlongSmoothedBearing + 540) % 360) - 180
      this.flyAlongSmoothedBearing = (this.flyAlongSmoothedBearing + delta * 0.06 + 360) % 360

      this.flyAlongMarker?.setLngLat([x1, y1])

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

  // ─── Elevation profile (read-model for TrailDetailPanel) ────────────────

  getSelectedTrailProfile(samples = 60): {
    line: GeoJSON.Feature<GeoJSON.LineString>
    lengthKm: number
    elevations: number[]
    gainM: number
    lossM: number
  } | null {
    if (this.selectedTrailId === null) return null
    const line = this.assembleTrailLine(this.selectedTrailId)
    if (!line || line.geometry.coordinates.length < 2) return null

    const lengthKm = length(line, { units: 'kilometers' })

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
}
