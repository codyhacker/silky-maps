import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface SectionsOpenState {
  filters: boolean
  style: boolean
  display: boolean
  appearance: boolean
}

interface UIState {
  showBasemapMenu: boolean
  sectionsOpen: SectionsOpenState
  showControls: boolean
  showLegend: boolean
}

const initialState: UIState = {
  showBasemapMenu: false,
  sectionsOpen: { filters: false, style: false, display: false, appearance: false },
  showControls: false,
  showLegend: false,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setShowBasemapMenu(state, action: PayloadAction<boolean>) {
      state.showBasemapMenu = action.payload
    },
    toggleSection(state, action: PayloadAction<keyof SectionsOpenState>) {
      state.sectionsOpen[action.payload] = !state.sectionsOpen[action.payload]
    },
    setShowControls(state, action: PayloadAction<boolean>) {
      state.showControls = action.payload
    },
    setShowLegend(state, action: PayloadAction<boolean>) {
      state.showLegend = action.payload
    },
    closeMobilePanels(state) {
      state.showControls = false
      state.showLegend = false
    },
  },
})

export const { setShowBasemapMenu, toggleSection, setShowControls, setShowLegend, closeMobilePanels } = uiSlice.actions
export default uiSlice.reducer
