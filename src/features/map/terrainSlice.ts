import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { loadPersisted } from '../../app/persist'

interface TerrainState {
  terrainExaggeration: number
}

const initialState: TerrainState = {
  terrainExaggeration: 1.5,
  ...loadPersisted<TerrainState>('terrain'),
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
