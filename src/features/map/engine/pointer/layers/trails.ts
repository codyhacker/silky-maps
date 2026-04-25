import type { GeoJSONFeature, Map } from 'mapbox-gl'
import { setHoveredTrail, setSelectedTrail } from '../../../../trails/interactionSlice'
import type { TrailProperties } from '../../../../../shared/types'
import type { InteractiveLayer, LayerPointerEvent } from '../InteractiveLayer'

const PRIMARY = 'trails-primary'
const THRU = 'trails-thru'

const TRAIL_SOURCES: Array<{ id: string; sourceLayer: string }> = [
  { id: 'trails', sourceLayer: 'trails' },
  { id: 'thruhikes', sourceLayer: 'thruhikes' },
]

let hoveredId: string | number | null = null

function trailKey(f: GeoJSONFeature): string | number | null {
  return f.id ?? (f.properties as { osm_id?: string | number } | null)?.osm_id ?? null
}

function setHoverState(map: Map, id: string | number, hover: boolean): void {
  for (const src of TRAIL_SOURCES) {
    if (!map.getSource(src.id)) continue
    map.setFeatureState({ source: src.id, sourceLayer: src.sourceLayer, id }, { hover })
  }
}

export const trailsLayer: InteractiveLayer = {
  id: 'trails',
  layerIds: [PRIMARY, THRU],
  hitMode: 'bbox',
  priority: 0,
  getHitKey: trailKey,

  handle(event: LayerPointerEvent): void {
    const { kind, hit, allHits, dispatch, map } = event

    if (kind === 'hover') {
      const newKey = hit ? trailKey(hit) : null
      if (hoveredId !== null && hoveredId !== newKey) {
        setHoverState(map, hoveredId, false)
        hoveredId = null
      }
      if (newKey !== null) {
        hoveredId = newKey
        setHoverState(map, hoveredId, true)
      }
      dispatch(setHoveredTrail(newKey))
      return
    }

    // click / dblclick
    if (hit) {
      const id = trailKey(hit)
      if (id !== null) {
        dispatch(setSelectedTrail({ id, props: hit.properties as TrailProperties }))
      }
      return
    }

    const anyOtherHit = Object.entries(allHits).some(([id, f]) => id !== 'trails' && f !== null)
    if (!anyOtherHit) {
      dispatch(setSelectedTrail(null))
    }
  },
}
