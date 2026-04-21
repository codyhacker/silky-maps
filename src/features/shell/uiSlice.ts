import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface SectionsOpenState {
  filters: boolean
  dataStyle: boolean
  trails: boolean
  mapStyle: boolean
}

interface UIState {
  sectionsOpen: SectionsOpenState
  showControls: boolean
  showLegend: boolean
  // Desktop-only: legend can be collapsed to a small pill so it doesn't
  // dominate the bottom-right corner. Mobile ignores this and always shows
  // full content when the user explicitly taps the toggle.
  legendCollapsed: boolean
}

const initialState: UIState = {
  sectionsOpen: { filters: false, dataStyle: false, trails: false, mapStyle: false },
  showControls: false,
  showLegend: false,
  legendCollapsed: true,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSection(state, action: PayloadAction<keyof SectionsOpenState>) {
      state.sectionsOpen[action.payload] = !state.sectionsOpen[action.payload]
    },
    setShowControls(state, action: PayloadAction<boolean>) {
      state.showControls = action.payload
    },
    setShowLegend(state, action: PayloadAction<boolean>) {
      state.showLegend = action.payload
    },
    toggleLegendCollapsed(state) {
      state.legendCollapsed = !state.legendCollapsed
    },
    setLegendCollapsed(state, action: PayloadAction<boolean>) {
      state.legendCollapsed = action.payload
    },
    closeMobilePanels(state) {
      state.showControls = false
      state.showLegend = false
    },
  },
})

export const {
  toggleSection,
  setShowControls,
  setShowLegend,
  toggleLegendCollapsed,
  setLegendCollapsed,
  closeMobilePanels,
} = uiSlice.actions
export default uiSlice.reducer
