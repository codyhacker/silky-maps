import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type TrailSurface = 'paved' | 'gravel' | 'unpaved'
export type TrailDifficulty = 'any' | 'easy' | 'moderate' | 'hard'

interface TrailsFilterState {
  // Master toggle — when false, the trails sources stay declared in the
  // augmentation spec but every trails-* layer is omitted entirely so
  // Mapbox doesn't pay the per-tile parse cost.
  visible: boolean
  // null = no upper bound; otherwise trails longer than this are filtered out.
  maxLengthKm: number | null
  // Empty array = "all surfaces"; ['paved'] = paved-only; etc.
  surfaces: TrailSurface[]
  difficulty: TrailDifficulty
  // Render only the named long-distance routes. Useful at low zoom where
  // the local trails layer is hidden anyway (`-B 8` in the bake) and the
  // user wants a clean PCT/AT/GR-only world view.
  thruHikesOnly: boolean
}

const initialState: TrailsFilterState = {
  visible: true,
  maxLengthKm: null,
  surfaces: [],
  difficulty: 'any',
  thruHikesOnly: false,
}

const trailsFilterSlice = createSlice({
  name: 'trailsFilter',
  initialState,
  reducers: {
    setTrailsVisible(state, action: PayloadAction<boolean>) {
      state.visible = action.payload
    },
    setMaxLengthKm(state, action: PayloadAction<number | null>) {
      state.maxLengthKm = action.payload
    },
    toggleSurface(state, action: PayloadAction<TrailSurface>) {
      const idx = state.surfaces.indexOf(action.payload)
      if (idx === -1) state.surfaces.push(action.payload)
      else state.surfaces.splice(idx, 1)
    },
    setDifficulty(state, action: PayloadAction<TrailDifficulty>) {
      state.difficulty = action.payload
    },
    setThruHikesOnly(state, action: PayloadAction<boolean>) {
      state.thruHikesOnly = action.payload
    },
  },
})

export const {
  setTrailsVisible,
  setMaxLengthKm,
  toggleSurface,
  setDifficulty,
  setThruHikesOnly,
} = trailsFilterSlice.actions
export default trailsFilterSlice.reducer
