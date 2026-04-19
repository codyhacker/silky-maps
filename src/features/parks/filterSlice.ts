import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface ParksFilterState {
  selectedCategory: string
  selectedDesignation: string
}

const initialState: ParksFilterState = {
  selectedCategory: 'National',
  selectedDesignation: 'National Park',
}

const parksFilterSlice = createSlice({
  name: 'parksFilter',
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

export const { setCategory, setCategoryAndResetDesignation, setDesignation } = parksFilterSlice.actions
export default parksFilterSlice.reducer
