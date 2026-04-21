import { useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setPendingParkId } from '../parks/interactionSlice'
import { useMapEngine } from '../map/engine/MapEngineContext'

// Minimal URL sync: the URL is reserved for landmark deep-links only — a
// shared `?p=<SITE_PID>` selects that park on load, and the URL stays in sync
// with the active selection. Style, camera, terrain, and trail filters are
// intentionally *not* persisted; they're considered ephemeral session state.
//
// Restoration is gated on the WDPA (`national-parks`) source being present
// in the style — dispatching `setPendingParkId` before the source is added
// would invoke `querySourceFeatures` on a missing source. The engine's own
// retry path handles the secondary case of the source being loaded but the
// specific park's tile not yet streamed in.
export function useUrlSync() {
  const engine = useMapEngine()
  const dispatch = useAppDispatch()
  const selectedFeature = useAppSelector(s => s.parksInteraction.selectedFeature)

  // Guards against React StrictMode's double-mount restore.
  const restoredRef = useRef(false)
  // Holds Effect B off until Effect A's dispatch has propagated, so we don't
  // immediately overwrite a deep-linked `?p=...` with the empty selection.
  const writeReadyRef = useRef(false)

  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true

    const p = new URLSearchParams(window.location.search)
    const parkId = p.get('p') ?? p.get('park')
    if (!parkId) {
      writeReadyRef.current = true
      return
    }

    engine.whenWdpaReady(() => {
      dispatch(setPendingParkId(parkId))
      Promise.resolve().then(() => { writeReadyRef.current = true })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!writeReadyRef.current) return

    const p = new URLSearchParams(window.location.search)
    if (selectedFeature?.SITE_PID != null) {
      p.set('p', String(selectedFeature.SITE_PID))
    } else {
      p.delete('p')
      p.delete('park')
    }

    const qs = p.toString()
    window.history.replaceState(null, '', qs ? '?' + qs : window.location.pathname)
  }, [selectedFeature])
}
