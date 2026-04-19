import { configureStore } from '@reduxjs/toolkit'
import { listenerMiddleware } from './listenerMiddleware'
import mapStyleReducer from '../features/parks/mapStyleSlice'
import mapFilterReducer from '../features/parks/mapFilterSlice'
import terrainReducer from '../features/parks/terrainSlice'
import mapInteractionReducer from '../features/map-core/mapInteractionSlice'
import commandedCameraReducer from '../features/map-core/commandedCameraSlice'
import uiReducer from '../features/chrome/uiSlice'

export const store = configureStore({
  reducer: {
    mapStyle: mapStyleReducer,
    mapFilter: mapFilterReducer,
    terrain: terrainReducer,
    mapInteraction: mapInteractionReducer,
    commandedCamera: commandedCameraReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(listenerMiddleware.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export type AppStore = typeof store
