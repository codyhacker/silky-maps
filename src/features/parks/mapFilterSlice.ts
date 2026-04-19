import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface MapFilterState {
  selectedCategory: string
  selectedDesignation: string
}

const initialState: MapFilterState = {
  selectedCategory: 'National',
  selectedDesignation: 'National Park',
}

const mapFilterSlice = createSlice({
  name: 'mapFilter',
  initialState,
  reducers: {
    setCategory(state, action: PayloadAction<string>) {
      state.selectedCategory = action.payload
    },
    setCategoryAndResetDesignation(state, action: PayloadAction<string>) {
      state.selectedCategory = action.payload
      state.selectedDesignation = 'all'
    },
    setDesignation(state, action: PayloadAction<string>) {
      state.selectedDesignation = action.payload
    },
  },
})

export const { setCategory, setCategoryAndResetDesignation, setDesignation } = mapFilterSlice.actions
export default mapFilterSlice.reducer
