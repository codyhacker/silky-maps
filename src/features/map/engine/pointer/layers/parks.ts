import type { Map } from 'mapbox-gl'
import { setHoveredFeature, setSelectedFeature } from '../../../../parks/interactionSlice'
import { setSelectedTrail } from '../../../../trails/interactionSlice'
import type { HoveredFeatureProperties } from '../../../../../shared/types'
import type { InteractiveLayer, LayerPointerEvent } from '../InteractiveLayer'

const SOURCE = 'national-parks'
const SOURCE_LAYER = 'geo'
const PARKS_FILL_LAYER = 'parks-fill'

// Tracks which park id currently has its `hover` feature-state set, so the
// next hover transition can flip it off. Module-local because the router
// only invokes `handle` on hover transitions and doesn't pass the prior hit.
let hoveredId: string | number | null = null

function setHoverState(map: Map, id: string | number, hover: boolean): void {
  if (!map.getSource(SOURCE)) return
  map.setFeatureState({ source: SOURCE, sourceLayer: SOURCE_LAYER, id }, { hover })
}

export const parksLayer: InteractiveLayer = {
  id: 'parks',
  layerIds: [PARKS_FILL_LAYER],
  hitMode: 'point',
  priority: 1,

  handle(event: LayerPointerEvent): void {
    const { kind, hit, allHits, dispatch, map } = event

    if (kind === 'hover') {
      if (hoveredId !== null && hoveredId !== hit?.id) {
        setHoverState(map, hoveredId, false)
        hoveredId = null
      }
      if (hit?.id !== undefined && hit.id !== null) {
        hoveredId = hit.id
        setHoverState(map, hoveredId, true)
      }
      dispatch(setHoveredFeature((hit?.properties ?? null) as HoveredFeatureProperties | null))
      return
    }

    // click / dblclick
    if (hit) {
      dispatch(setSelectedFeature(hit.properties as HoveredFeatureProperties))
      // Park-clears-trail (matches CLAUDE.md docs): if this park click did NOT
      // also hit a trail, drop any stale trail selection so the user isn't
      // left with an unrelated trail panel tabbed alongside the new park.
      if (allHits.trails == null) {
        dispatch(setSelectedTrail(null))
      }
      return
    }

    // No park hit. Only clear if no other layer caught this click — empty-land
    // click clears everything; trail-only click leaves park selection intact.
    const anyOtherHit = Object.entries(allHits).some(([id, f]) => id !== 'parks' && f !== null)
    if (!anyOtherHit) {
      dispatch(setSelectedFeature(null))
    }
  },
}
