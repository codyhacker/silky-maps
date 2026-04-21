import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { HoveredFeatureProperties } from '../../shared/types'
import type { ObservedCamera } from '../map/cameraSlice'

const STORAGE_KEY = 'silkymaps_favorites'

export interface FavoriteEntry {
  id: string
  feature: HoveredFeatureProperties
  camera: ObservedCamera
  savedAt: number
}

interface FavoritesState {
  entries: FavoriteEntry[]
  drawerOpen: boolean
}

function loadFromStorage(): FavoriteEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as FavoriteEntry[]) : []
  } catch {
    return []
  }
}

function saveToStorage(entries: FavoriteEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // quota exceeded or private browsing — fail silently
  }
}

const favoritesSlice = createSlice({
  name: 'favorites',
  initialState: (): FavoritesState => ({
    entries: loadFromStorage(),
    drawerOpen: false,
  }),
  reducers: {
    addFavorite(state, action: PayloadAction<{ feature: HoveredFeatureProperties; camera: ObservedCamera }>) {
      const { feature, camera } = action.payload
      const id = String(feature.SITE_PID ?? feature.NAME ?? Date.now())
      state.entries = state.entries.filter(e => e.id !== id)
      state.entries.unshift({ id, feature, camera, savedAt: Date.now() })
      saveToStorage(state.entries)
    },
    removeFavorite(state, action: PayloadAction<string>) {
      state.entries = state.entries.filter(e => e.id !== action.payload)
      saveToStorage(state.entries)
    },
    setFavoritesDrawerOpen(state, action: PayloadAction<boolean>) {
      state.drawerOpen = action.payload
    },
  },
})

export const { addFavorite, removeFavorite, setFavoritesDrawerOpen } = favoritesSlice.actions
export default favoritesSlice.reducer
