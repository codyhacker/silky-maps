import type { GeoJSONFeature, Map, MapMouseEvent, Point, PointLike } from 'mapbox-gl'
import type { AppStore } from '../../../../app/store'
import type { InteractiveLayer, LayerPointerEvent, PointerContext } from './InteractiveLayer'

const DEFAULT_BBOX_PADDING = 6

export function registerPointerRouter(
  map: Map,
  store: AppStore,
  layers: InteractiveLayer[],
): () => void {
  // Iterate in declared priority order (lower runs first).
  const ordered = [...layers].sort((a, b) => a.priority - b.priority)

  // Per-layer last hover hit key, used to dedupe hover dispatches so a steady
  // hover doesn't refire `handle` on every animation frame.
  const lastHitKey: Record<string, string | number | null> = {}
  for (const l of ordered) lastHitKey[l.id] = null

  const dispatch = store.dispatch.bind(store)

  // Single hit test for one layer at a screen point. Returns null if the
  // layer's mapbox layers aren't in the live style yet (trails toggle).
  function hitTest(layer: InteractiveLayer, point: Point): GeoJSONFeature | null {
    const presentLayers = layer.layerIds.filter(id => map.getLayer(id))
    if (presentLayers.length === 0) return null

    const query: PointLike | [PointLike, PointLike] = layer.hitMode === 'bbox'
      ? (() => {
          const pad = layer.bboxPadding ?? DEFAULT_BBOX_PADDING
          return [
            [point.x - pad, point.y - pad],
            [point.x + pad, point.y + pad],
          ]
        })()
      : point

    const features = map.queryRenderedFeatures(query, { layers: presentLayers })
    return features[0] ?? null
  }

  function buildAllHits(point: Point): Record<string, GeoJSONFeature | null> {
    const out: Record<string, GeoJSONFeature | null> = {}
    for (const layer of ordered) out[layer.id] = hitTest(layer, point)
    return out
  }

  function buildCtx(originalEvent: MouseEvent | undefined, isDouble: boolean): PointerContext {
    const e = originalEvent
    return {
      shiftKey: e?.shiftKey ?? false,
      ctrlKey: e?.ctrlKey ?? false,
      altKey: e?.altKey ?? false,
      metaKey: e?.metaKey ?? false,
      isDouble,
      tourActive: store.getState().parksInteraction.tourActive,
    }
  }

  function keyOf(layer: InteractiveLayer, hit: GeoJSONFeature | null): string | number | null {
    if (!hit) return null
    if (layer.getHitKey) return layer.getHitKey(hit)
    return hit.id ?? null
  }

  // ─── Click + dblclick ─────────────────────────────────────────────────────
  function dispatchClick(e: MapMouseEvent, isDouble: boolean): void {
    const allHits = buildAllHits(e.point)
    const ctx = buildCtx(e.originalEvent, isDouble)
    for (const layer of ordered) {
      const event: LayerPointerEvent = {
        kind: 'click',
        hit: allHits[layer.id],
        allHits,
        ctx,
        dispatch,
        map,
      }
      layer.handle(event)
    }
  }

  const onClick = (e: MapMouseEvent): void => dispatchClick(e, false)
  const onDblClick = (e: MapMouseEvent): void => dispatchClick(e, true)

  // ─── Mousemove (rAF-coalesced) + mouseout ────────────────────────────────
  let pendingMove: MapMouseEvent | null = null
  let rafId: number | null = null

  function flushMove(): void {
    rafId = null
    const e = pendingMove
    pendingMove = null
    if (!e) return

    const allHits = buildAllHits(e.point)

    // Cursor: pointer if any layer hit.
    const anyHit = ordered.some(l => allHits[l.id] !== null)
    map.getCanvas().style.cursor = anyHit ? 'pointer' : ''

    const ctx = buildCtx(e.originalEvent, false)
    for (const layer of ordered) {
      const hit = allHits[layer.id]
      const key = keyOf(layer, hit)
      if (key === lastHitKey[layer.id]) continue
      lastHitKey[layer.id] = key
      layer.handle({ kind: 'hover', hit, allHits, ctx, dispatch, map })
    }
  }

  const onMove = (e: MapMouseEvent): void => {
    pendingMove = e
    if (rafId === null) rafId = requestAnimationFrame(flushMove)
  }

  // Cursor leaves the canvas — clear all hovers and reset cursor.
  const onOut = (): void => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
      pendingMove = null
    }
    map.getCanvas().style.cursor = ''
    const ctx = buildCtx(undefined, false)
    const emptyHits: Record<string, GeoJSONFeature | null> = {}
    for (const layer of ordered) emptyHits[layer.id] = null
    for (const layer of ordered) {
      if (lastHitKey[layer.id] === null) continue
      lastHitKey[layer.id] = null
      layer.handle({ kind: 'hover', hit: null, allHits: emptyHits, ctx, dispatch, map })
    }
  }

  map.on('click', onClick)
  map.on('dblclick', onDblClick)
  map.on('mousemove', onMove)
  map.on('mouseout', onOut)

  return () => {
    map.off('click', onClick)
    map.off('dblclick', onDblClick)
    map.off('mousemove', onMove)
    map.off('mouseout', onOut)
    if (rafId !== null) cancelAnimationFrame(rafId)
    pendingMove = null
  }
}
