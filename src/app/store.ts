import { configureStore } from '@reduxjs/toolkit'
import { listenerMiddleware } from './listenerMiddleware'

// ── map/ ────────────────────────────────────────────────────────────────────
import mapStyleReducer    from '../features/map/styleSlice'
import terrainReducer     from '../features/map/terrainSlice'
import cameraReducer      from '../features/map/cameraSlice'

// ── parks/ ──────────────────────────────────────────────────────────────────
import parksFilterReducer      from '../features/parks/filterSlice'
import parksInteractionReducer from '../features/parks/interactionSlice'

// ── shell/ ──────────────────────────────────────────────────────────────────
import uiReducer from '../features/shell/uiSlice'

export const store = configureStore({
  reducer: {
    mapStyle:         mapStyleReducer,
    terrain:          terrainReducer,
    camera:           cameraReducer,
    parksFilter:      parksFilterReducer,
    parksInteraction: parksInteractionReducer,
    ui:               uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(listenerMiddleware.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export type AppStore = typeof store
