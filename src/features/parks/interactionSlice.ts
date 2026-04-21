import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { HoveredFeatureProperties } from '../../shared/types'

interface ParksInteractionState {
  hoveredFeature: HoveredFeatureProperties | null
  selectedFeature: HoveredFeatureProperties | null
  // True while the "Full detail" view is open and the engine is running an
  // orbit tour around the selected park. Selecting a different feature (or
  // closing the panel) auto-resets this to false in the reducer below so the
  // listener middleware can tear down the tour.
  tourActive: boolean
  // Park id from a deep-link URL, waiting for map tiles to load so the engine
  // can resolve it into a full selectedFeature. Cleared once resolved.
  pendingParkId: string | null
}

const initialState: ParksInteractionState = {
  hoveredFeature: null,
  selectedFeature: null,
  tourActive: false,
  pendingParkId: null,
}

const parksInteractionSlice = createSlice({
  name: 'parksInteraction',
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
    setPendingParkId(state, action: PayloadAction<string | null>) {
      state.pendingParkId = action.payload
    },
  },
})

export const {
  setHoveredFeature,
  setSelectedFeature,
  setTourActive,
  setPendingParkId,
} = parksInteractionSlice.actions
export default parksInteractionSlice.reducer
