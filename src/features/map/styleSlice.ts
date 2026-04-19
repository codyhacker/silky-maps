import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { DEFAULT_UI_THEME_ID } from '../../shared/constants/uiThemes'

interface MapStyleState {
  selectedTheme: number
  fillOpacity: number
  selectedBasemap: string
  selectedUiTheme: string
  uiMode: 'dark' | 'light'
  basemapSync: boolean
}

const initialState: MapStyleState = {
  selectedTheme: 1,
  fillOpacity: 0.5,
  selectedBasemap: 'earth',
  selectedUiTheme: DEFAULT_UI_THEME_ID,
  uiMode: 'dark',
  basemapSync: true,
}

const mapStyleSlice = createSlice({
  name: 'mapStyle',
  initialState,
  reducers: {
    setSelectedTheme(state, action: PayloadAction<number>) {
      state.selectedTheme = action.payload
    },
    setFillOpacity(state, action: PayloadAction<number>) {
      state.fillOpacity = action.payload
    },
    setSelectedBasemap(state, action: PayloadAction<string>) {
      state.selectedBasemap = action.payload
    },
    setSelectedUiTheme(state, action: PayloadAction<string>) {
      state.selectedUiTheme = action.payload
    },
    setUiMode(state, action: PayloadAction<'dark' | 'light'>) {
      state.uiMode = action.payload
    },
    setBasemapSync(state, action: PayloadAction<boolean>) {
      state.basemapSync = action.payload
      if (action.payload) state.selectedBasemap = 'earth'
    },
  },
})

export const {
  setSelectedTheme,
  setFillOpacity,
  setSelectedBasemap,
  setSelectedUiTheme,
  setUiMode,
  setBasemapSync,
} = mapStyleSlice.actions
export default mapStyleSlice.reducer
