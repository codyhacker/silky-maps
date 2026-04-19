import { startAppListening } from '../../../app/listenerMiddleware'
import { setSelectedBasemap, setSelectedUiTheme } from '../styleSlice'
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

  // Tour lifecycle: any change to `tourActive` (set directly via setTourActive
  // OR cleared as a side-effect of setSelectedFeature) drives the engine.
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
