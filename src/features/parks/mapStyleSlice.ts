import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { DEFAULT_UI_THEME_ID } from '../../shared/constants/uiThemes'

interface MapStyleState {
  selectedTheme: number
  fillOpacity: number
  selectedBasemap: string
  selectedUiTheme: string
}

const initialState: MapStyleState = {
  selectedTheme: 1,
  fillOpacity: 0.5,
  selectedBasemap: 'earth',
  selectedUiTheme: DEFAULT_UI_THEME_ID,
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
  },
})

export const {
  setSelectedTheme,
  setFillOpacity,
  setSelectedBasemap,
  setSelectedUiTheme,
} = mapStyleSlice.actions
export default mapStyleSlice.reducer
