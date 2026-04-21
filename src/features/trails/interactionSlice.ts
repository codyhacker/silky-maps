import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { TrailProperties } from '../../shared/types'

interface TrailsInteractionState {
  hoveredTrailId: string | number | null
  selectedTrailId: string | number | null
  selectedTrailProps: TrailProperties | null
  flyAlongActive: boolean
  // 0–1 progress along the trail, dispatched by the engine each RAF frame.
  flyAlongProgress: number
  // True while the user is scrubbing the elevation chart; the engine RAF
  // loop keeps running but stops advancing progress.
  flyAlongPaused: boolean
}

const initialState: TrailsInteractionState = {
  hoveredTrailId: null,
  selectedTrailId: null,
  selectedTrailProps: null,
  flyAlongActive: false,
  flyAlongProgress: 0,
  flyAlongPaused: false,
}

const trailsInteractionSlice = createSlice({
  name: 'trailsInteraction',
  initialState,
  reducers: {
    setHoveredTrail(state, action: PayloadAction<string | number | null>) {
      state.hoveredTrailId = action.payload
    },
    setSelectedTrail(
      state,
      action: PayloadAction<{ id: string | number; props: TrailProperties } | null>,
    ) {
      if (action.payload === null) {
        state.selectedTrailId = null
        state.selectedTrailProps = null
      } else {
        state.selectedTrailId = action.payload.id
        state.selectedTrailProps = action.payload.props
      }
      state.flyAlongActive = false
      state.flyAlongPaused = false
      state.flyAlongProgress = 0
    },
    setFlyAlongActive(state, action: PayloadAction<boolean>) {
      state.flyAlongActive = state.selectedTrailId !== null && action.payload
      if (!state.flyAlongActive) {
        state.flyAlongPaused = false
        state.flyAlongProgress = 0
      }
    },
    setFlyAlongProgress(state, action: PayloadAction<number>) {
      state.flyAlongProgress = Math.max(0, Math.min(1, action.payload))
    },
    setFlyAlongPaused(state, action: PayloadAction<boolean>) {
      // Only meaningful while fly-along is active.
      state.flyAlongPaused = state.flyAlongActive && action.payload
    },
  },
})

export const {
  setHoveredTrail,
  setSelectedTrail,
  setFlyAlongActive,
  setFlyAlongProgress,
  setFlyAlongPaused,
} = trailsInteractionSlice.actions
export default trailsInteractionSlice.reducer
