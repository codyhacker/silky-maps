import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

// ─── Commanded camera (Redux → engine) ───────────────────────────────────────
//
// Serializable payloads — no Mapbox class instances in Redux state. The engine
// listens for the latest dispatch and translates it into an imperative
// `flyTo` / `fitBounds` call.

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

// ─── Observed camera (engine → Redux) ────────────────────────────────────────
//
// Updated on every `moveend` so other features can react to the live camera
// (currently nobody reads it, but keeping the channel open makes future
// "follow camera" UIs trivial).

export interface ObservedCamera {
  center: [number, number]
  zoom: number
  bearing: number
  pitch: number
}

interface CameraState {
  lastFlyTo: FlyToPayload | null
  lastFitBounds: FitBoundsPayload | null
  observed: ObservedCamera | null
}

const initialState: CameraState = {
  lastFlyTo: null,
  lastFitBounds: null,
  observed: null,
}

const cameraSlice = createSlice({
  name: 'camera',
  initialState,
  reducers: {
    flyTo(state, action: PayloadAction<FlyToPayload>) {
      state.lastFlyTo = action.payload
    },
    fitBounds(state, action: PayloadAction<FitBoundsPayload>) {
      state.lastFitBounds = action.payload
    },
    cameraObserved(state, action: PayloadAction<ObservedCamera>) {
      state.observed = action.payload
    },
  },
})

export const { flyTo, fitBounds, cameraObserved } = cameraSlice.actions
export default cameraSlice.reducer
