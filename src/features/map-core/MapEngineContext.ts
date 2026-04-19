import { createContext, useContext } from 'react'
import type { MapEngine } from './MapEngine'

export const MapEngineContext = createContext<MapEngine | null>(null)

export function useMapEngine(): MapEngine {
  const engine = useContext(MapEngineContext)
  if (!engine) throw new Error('useMapEngine must be used within MapEngineContext.Provider')
  return engine
}
