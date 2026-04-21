import { configureStore } from '@reduxjs/toolkit'
import { listenerMiddleware } from './listenerMiddleware'

// ── map/ ────────────────────────────────────────────────────────────────────
import mapStyleReducer    from '../features/map/styleSlice'
import terrainReducer     from '../features/map/terrainSlice'
import cameraReducer      from '../features/map/cameraSlice'

// ── parks/ ──────────────────────────────────────────────────────────────────
import parksFilterReducer      from '../features/parks/filterSlice'
import parksInteractionReducer from '../features/parks/interactionSlice'

// ── trails/ ─────────────────────────────────────────────────────────────────
import trailsFilterReducer      from '../features/trails/filterSlice'
import trailsInteractionReducer from '../features/trails/interactionSlice'

// ── shell/ ──────────────────────────────────────────────────────────────────
import uiReducer from '../features/shell/uiSlice'

// ── favorites/ ──────────────────────────────────────────────────────────────
import favoritesReducer from '../features/favorites/favoritesSlice'

export const store = configureStore({
  reducer: {
    mapStyle:         mapStyleReducer,
    terrain:          terrainReducer,
    camera:           cameraReducer,
    parksFilter:       parksFilterReducer,
    parksInteraction:  parksInteractionReducer,
    trailsFilter:      trailsFilterReducer,
    trailsInteraction: trailsInteractionReducer,
    ui:                uiReducer,
    favorites:        favoritesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(listenerMiddleware.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export type AppStore = typeof store
