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
}

const initialState: MapInteractionState = {
  hoveredFeature: null,
  selectedFeature: null,
  camera: null,
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
    },
    cameraObserved(state, action: PayloadAction<ObservedCamera>) {
      state.camera = action.payload
    },
  },
})

export const { setHoveredFeature, setSelectedFeature, cameraObserved } = mapInteractionSlice.actions
export default mapInteractionSlice.reducer
