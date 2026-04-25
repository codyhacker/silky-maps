import type { GeoJSONFeature, Map } from 'mapbox-gl'
import type { UnknownAction } from '@reduxjs/toolkit'

export interface PointerContext {
  shiftKey: boolean
  ctrlKey: boolean
  altKey: boolean
  metaKey: boolean
  isDouble: boolean
  tourActive: boolean
}

// Renamed from `PointerEvent` to avoid collision with the DOM global. This is
// what each layer's `handle` method receives for both clicks and hovers.
export interface LayerPointerEvent {
  kind: 'click' | 'hover'
  hit: GeoJSONFeature | null
  allHits: Record<string, GeoJSONFeature | null>
  ctx: PointerContext
  dispatch: (action: UnknownAction) => void
  map: Map
}

export interface InteractiveLayer {
  id: string
  layerIds: string[]
  hitMode: 'point' | 'bbox'
  bboxPadding?: number
  priority: number

  // Stable identity for a hit feature. The router uses this to dedupe hover
  // events — `handle` is only re-invoked when the key changes for this layer.
  // Default extractor (when omitted) returns `f.id ?? null`.
  getHitKey?: (f: GeoJSONFeature) => string | number | null

  handle(event: LayerPointerEvent): void
}
