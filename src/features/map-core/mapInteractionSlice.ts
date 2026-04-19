import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { HoveredFeatureProperties } from '../../shared/types'

export interface ObservedCamera {
  center: [number, number]
  zoom: number
  bearing: number
  pitch: number
}

interface MapInteractionState {
  hoveredFeature: HoveredFeatureProperties | null
  selectedFeature: HoveredFeatureProperties | null
  camera: ObservedCamera | null
  // True while the "Full detail" view is open and the engine is running an
  // orbit tour around the selected park. Selecting a different feature (or
  // closing the panel) auto-resets this to false in the reducer below so the
  // listener middleware can tear down the tour.
  tourActive: boolean
}

const initialState: MapInteractionState = {
  hoveredFeature: null,
  selectedFeature: null,
  camera: null,
  tourActive: false,
}

const mapInteractionSlice = createSlice({
  name: 'mapInteraction',
  initialState,
  reducers: {
    setHoveredFeature(state, action: PayloadAction<HoveredFeatureProperties | null>) {
      state.hoveredFeature = action.payload
    },
    setSelectedFeature(state, action: PayloadAction<HoveredFeatureProperties | null>) {
      state.selectedFeature = action.payload
      // Any new selection (or deselection) ends a tour-in-progress.
      state.tourActive = false
    },
    setTourActive(state, action: PayloadAction<boolean>) {
      // Tours are meaningless without a selection — guard so a stale dispatch
      // can't activate the engine path.
      state.tourActive = !!state.selectedFeature && action.payload
    },
    cameraObserved(state, action: PayloadAction<ObservedCamera>) {
      state.camera = action.payload
    },
  },
})

export const {
  setHoveredFeature,
  setSelectedFeature,
  setTourActive,
  cameraObserved,
} = mapInteractionSlice.actions
export default mapInteractionSlice.reducer
