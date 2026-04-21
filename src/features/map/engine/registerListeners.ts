import { startAppListening } from '../../../app/listenerMiddleware'
import { setSelectedBasemap, setSelectedUiTheme, setUiMode, setBasemapSync } from '../styleSlice'
import { selectAugmentationSpec } from './styleAugmentation'
import { flyTo, fitBounds } from '../cameraSlice'
import { setPendingParkId } from '../../parks/interactionSlice'
import { setSelectedTrail } from '../../trails/interactionSlice'
import type { MapEngine } from './MapEngine'

export function registerMapListeners(engine: MapEngine): () => void {
  const unsubs: (() => void)[] = []

  unsubs.push(startAppListening({
    predicate: (_action, currentState, previousState) =>
      selectAugmentationSpec(currentState) !== selectAugmentationSpec(previousState),
    effect: (_action, api) => {
      engine.execute({ type: 'STYLE_RECONCILE', spec: selectAugmentationSpec(api.getState()) })
    },
  }))

  unsubs.push(startAppListening({
    actionCreator: setSelectedBasemap,
    effect: (action) => {
      engine.execute({ type: 'BASEMAP_CHANGE', basemapId: action.payload })
    },
  }))

  unsubs.push(startAppListening({
    actionCreator: setSelectedUiTheme,
    effect: (action) => {
      engine.execute({ type: 'UI_THEME_CHANGE', themeId: action.payload })
    },
  }))

  unsubs.push(startAppListening({
    actionCreator: setUiMode,
    effect: (_action, api) => {
      engine.execute({ type: 'UI_THEME_CHANGE', themeId: api.getState().mapStyle.selectedUiTheme })
    },
  }))

  unsubs.push(startAppListening({
    actionCreator: setBasemapSync,
    effect: (action) => {
      if (action.payload) engine.execute({ type: 'BASEMAP_CHANGE', basemapId: 'earth' })
    },
  }))

  unsubs.push(startAppListening({
    actionCreator: flyTo,
    effect: (action) => {
      engine.execute({ type: 'FLY_TO', options: action.payload })
    },
  }))

  unsubs.push(startAppListening({
    actionCreator: fitBounds,
    effect: (action) => {
      engine.execute({ type: 'FIT_BOUNDS', bounds: action.payload.bounds, options: action.payload })
    },
  }))

  // Selection lifecycle: a change in selected SITE_PID drives the
  // mask + satellite overlay (and the camera fit). Selecting null tears
  // the overlay down and reverts the camera to its pre-selection state.
  unsubs.push(startAppListening({
    predicate: (_action, currentState, previousState) => {
      const c = currentState.parksInteraction.selectedFeature?.SITE_PID ?? null
      const p = previousState.parksInteraction.selectedFeature?.SITE_PID ?? null
      return c !== p
    },
    effect: (_action, api) => {
      const selected = api.getState().parksInteraction.selectedFeature
      if (selected?.SITE_PID != null) {
        engine.execute({ type: 'PARK_SELECT', siteId: selected.SITE_PID })
      } else {
        engine.execute({ type: 'PARK_DESELECT' })
      }
    },
  }))

  // Deep-link park restoration: resolve a SITE_PID from the URL into a full
  // feature once tiles stream in.
  unsubs.push(startAppListening({
    actionCreator: setPendingParkId,
    effect: (action) => {
      if (action.payload !== null) {
        engine.execute({ type: 'RESOLVE_PARK_BY_ID', id: action.payload })
      }
    },
  }))

  // Tour lifecycle: layered on top of selection. `tourActive` toggles only
  // the orbit (camera pitch + RAF rotation); the satellite/mask overlay is
  // owned by the selection listener above.
  unsubs.push(startAppListening({
    predicate: (_action, currentState, previousState) =>
      currentState.parksInteraction.tourActive !== previousState.parksInteraction.tourActive,
    effect: (_action, api) => {
      const state = api.getState()
      const selected = state.parksInteraction.selectedFeature
      if (state.parksInteraction.tourActive && selected?.SITE_PID != null) {
        engine.execute({ type: 'PARK_TOUR_START', siteId: selected.SITE_PID })
      } else {
        engine.execute({ type: 'PARK_TOUR_STOP' })
      }
    },
  }))

  // ── Trails ────────────────────────────────────────────────────────────
  // Listen on the action creator (rather than predicate-diffing the slice)
  // so we get the *intent* — selecting the same trail twice is a no-op
  // for the engine but should still be a no-op listener pass.
  unsubs.push(startAppListening({
    actionCreator: setSelectedTrail,
    effect: (action) => {
      if (action.payload === null) {
        engine.execute({ type: 'TRAIL_SELECT', trailId: null })
      } else {
        engine.execute({ type: 'TRAIL_SELECT', trailId: action.payload.id })
      }
    },
  }))

  // Fly-along lifecycle: predicate-diff so multi-step state updates that
  // happen to flip + reset the flag don't double-fire.
  unsubs.push(startAppListening({
    predicate: (_action, currentState, previousState) =>
      currentState.trailsInteraction.flyAlongActive !== previousState.trailsInteraction.flyAlongActive,
    effect: (_action, api) => {
      const state = api.getState()
      const id = state.trailsInteraction.selectedTrailId
      if (state.trailsInteraction.flyAlongActive && id !== null) {
        engine.execute({ type: 'START_FLY_ALONG', trailId: id })
      } else {
        engine.execute({ type: 'STOP_FLY_ALONG' })
      }
    },
  }))

  return () => unsubs.forEach(u => u())
}
