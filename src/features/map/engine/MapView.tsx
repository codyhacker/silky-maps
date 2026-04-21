import { useEffect, useRef, useState } from 'react'
import { useStore } from 'react-redux'
import { MapEngine } from './MapEngine'
import { MapEngineContext } from './MapEngineContext'
import { registerMapListeners } from './registerListeners'
import type { AppStore } from '../../../app/store'

interface MapViewProps {
  children: React.ReactNode
}

export function MapView({ children }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [engine, setEngine] = useState<MapEngine | null>(null)
  const store = useStore() as AppStore

  useEffect(() => {
    if (!containerRef.current) return

    const eng = new MapEngine(containerRef.current, store)
    const unregister = registerMapListeners(eng)
    setEngine(eng)

    return () => {
      unregister()
      eng.destroy()
      setEngine(null)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MapEngineContext.Provider value={engine}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {engine && children}
    </MapEngineContext.Provider>
  )
}
