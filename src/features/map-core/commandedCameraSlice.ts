import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

// Serializable payloads — no Mapbox class instances in Redux state
export interface FlyToPayload {
  center?: [number, number]
  zoom?: number
  bearing?: number
  pitch?: number
  duration?: number
  essential?: boolean
}

export interface FitBoundsPayload {
  bounds: [[number, number], [number, number]]
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number }
  maxZoom?: number
  duration?: number
}

interface CommandedCameraState {
  lastFlyTo: FlyToPayload | null
  lastFitBounds: FitBoundsPayload | null
}

const initialState: CommandedCameraState = {
  lastFlyTo: null,
  lastFitBounds: null,
}

const commandedCameraSlice = createSlice({
  name: 'commandedCamera',
  initialState,
  reducers: {
    flyTo(state, action: PayloadAction<FlyToPayload>) {
      state.lastFlyTo = action.payload
    },
    fitBounds(state, action: PayloadAction<FitBoundsPayload>) {
      state.lastFitBounds = action.payload
    },
  },
})

export const { flyTo, fitBounds } = commandedCameraSlice.actions
export default commandedCameraSlice.reducer
