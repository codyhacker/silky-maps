import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface TerrainState {
  terrainExaggeration: number
}

const initialState: TerrainState = {
  terrainExaggeration: 1.5,
}

const terrainSlice = createSlice({
  name: 'terrain',
  initialState,
  reducers: {
    setTerrainExaggeration(state, action: PayloadAction<number>) {
      state.terrainExaggeration = action.payload
    },
  },
})

export const { setTerrainExaggeration } = terrainSlice.actions
export default terrainSlice.reducer
