import { startAppListening } from '../../../app/listenerMiddleware'
import { setSelectedBasemap, setSelectedUiTheme, setUiMode, setBasemapSync } from '../styleSlice'
import { selectAugmentationSpec } from './styleAugmentation'
import { flyTo, fitBounds } from '../cameraSlice'
import type { MapEngine } from './MapEngine'

export function registerMapListeners(engine: MapEngine): void {
  startAppListening({
    predicate: (_action, currentState, previousState) =>
      selectAugmentationSpec(currentState) !== selectAugmentationSpec(previousState),
    effect: (_action, api) => {
      engine.execute({ type: 'STYLE_RECONCILE', spec: selectAugmentationSpec(api.getState()) })
    },
  })

  startAppListening({
    actionCreator: setSelectedBasemap,
    effect: (action) => {
      engine.execute({ type: 'BASEMAP_CHANGE', basemapId: action.payload })
    },
  })

  startAppListening({
    actionCreator: setSelectedUiTheme,
    effect: (action) => {
      engine.execute({ type: 'UI_THEME_CHANGE', themeId: action.payload })
    },
  })

  startAppListening({
    actionCreator: setUiMode,
    effect: (_action, api) => {
      engine.execute({ type: 'UI_THEME_CHANGE', themeId: api.getState().mapStyle.selectedUiTheme })
    },
  })

  startAppListening({
    actionCreator: setBasemapSync,
    effect: (action) => {
      if (action.payload) engine.execute({ type: 'BASEMAP_CHANGE', basemapId: 'earth' })
    },
  })

  startAppListening({
    actionCreator: flyTo,
    effect: (action) => {
      engine.execute({ type: 'FLY_TO', options: action.payload })
    },
  })

  startAppListening({
    actionCreator: fitBounds,
    effect: (action) => {
      engine.execute({ type: 'FIT_BOUNDS', bounds: action.payload.bounds, options: action.payload })
    },
  })

  // Selection lifecycle: a change in selected SITE_PID drives the
  // mask + satellite overlay (and the camera fit). Selecting null tears
  // the overlay down and reverts the camera to its pre-selection state.
  startAppListening({
    predicate: (_action, currentState, previousState) => {
      const c = currentState.parksInteraction.selectedFeature?.SITE_PID ?? null
      const p = previousState.parksInteraction.selectedFeature?.SITE_PID ?? null
      return c !== p
    },
    effect: (_action, api) => {
      const selected = api.getState().parksInteraction.selectedFeature
      if (selected?.SITE_PID != null) {
        engine.selectPark(selected.SITE_PID)
      } else {
        engine.deselectPark()
      }
    },
  })

  // Tour lifecycle: layered on top of selection. `tourActive` toggles only
  // the orbit (camera pitch + RAF rotation); the satellite/mask overlay is
  // owned by the selection listener above.
  startAppListening({
    predicate: (_action, currentState, previousState) =>
      currentState.parksInteraction.tourActive !== previousState.parksInteraction.tourActive,
    effect: (_action, api) => {
      const state = api.getState()
      const selected = state.parksInteraction.selectedFeature
      if (state.parksInteraction.tourActive && selected?.SITE_PID != null) {
        engine.startTour(selected.SITE_PID)
      } else {
        engine.stopTour()
      }
    },
  })
}
