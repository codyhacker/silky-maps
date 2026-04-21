import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppSelector } from '../../app/hooks'
import { ParkDetailPanel } from './ParkDetailPanel'
import { TrailDetailPanel } from './TrailDetailPanel'
import { HikerIcon } from '../../shared/components/HikerIcon'

type Tab = 'park' | 'trail'

const SNAP_COMPACT = 40  // vh — default open height, leaves most of the map visible
const SNAP_FULL    = 75  // vh — pulled-up state for reading content
const MIN_VH       = 16
const MAX_VH       = 87

// Returns the nearer of the two snap points.
function nearestSnap(vh: number): number {
  const mid = (SNAP_COMPACT + SNAP_FULL) / 2
  return vh < mid ? SNAP_COMPACT : SNAP_FULL
}

export function DetailPanel() {
  const parkFeature = useAppSelector(s => s.parksInteraction.selectedFeature)
  const trailProps  = useAppSelector(s => s.trailsInteraction.selectedTrailProps)
  const trailId     = useAppSelector(s => s.trailsInteraction.selectedTrailId)
  const tourActive  = useAppSelector(s => s.parksInteraction.tourActive)

  const parkVisible  = parkFeature !== null
  const trailVisible = trailProps !== null && trailId !== null
  const anyVisible   = parkVisible || trailVisible
  const bothVisible  = parkVisible && trailVisible

  const [activeTab, setActiveTab] = useState<Tab>('park')

  useEffect(() => {
    if (trailVisible) setActiveTab('trail')
    else if (parkVisible) setActiveTab('park')
  }, [trailVisible, parkVisible])

  // ── Drag-to-resize sheet (mobile only) ────────────────────────────────
  const [sheetVh, setSheetVh] = useState(SNAP_COMPACT)
  const [isDragging, setIsDragging] = useState(false)
  const dragState = useRef<{ startY: number; startVh: number } | null>(null)

  // Reset to compact each time the panel opens.
  const prevAnyVisible = useRef(anyVisible)
  useEffect(() => {
    if (!prevAnyVisible.current && anyVisible) setSheetVh(SNAP_COMPACT)
    prevAnyVisible.current = anyVisible
  }, [anyVisible])

  const onHandlePointerDown = useCallback((e: React.PointerEvent) => {
    if (window.innerWidth > 768) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragState.current = { startY: e.clientY, startVh: sheetVh }
    setIsDragging(true)
  }, [sheetVh])

  const onHandlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return
    const dyPx = dragState.current.startY - e.clientY
    const dyVh = (dyPx / window.innerHeight) * 100
    setSheetVh(Math.min(MAX_VH, Math.max(MIN_VH, dragState.current.startVh + dyVh)))
  }, [])

  const onHandlePointerUp = useCallback(() => {
    if (!dragState.current) return
    dragState.current = null
    setIsDragging(false)
    setSheetVh(prev => nearestSnap(prev))
  }, [])

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768

  const parkName  = parkFeature
    ? String(parkFeature.NAME_ENG || parkFeature.NAME || 'Park').slice(0, 18)
    : 'Park'
  const trailName = trailProps
    ? String((trailProps as Record<string, unknown>).name ?? (trailProps as Record<string, unknown>).ref ?? 'Trail').toString().slice(0, 18)
    : 'Trail'

  const cls = ['detail-panel']
  if (anyVisible)  cls.push('visible')
  if (tourActive)  cls.push('expanded')
  if (bothVisible) cls.push('detail-panel--tabbed')
  if (isDragging)  cls.push('dragging')

  // Apply dynamic height as a CSS custom property so the media-query rule
  // can reference it without needing JS to know which breakpoint is active.
  const sheetStyle = isMobile && !tourActive
    ? { '--sheet-height': `${sheetVh}vh` } as React.CSSProperties
    : undefined

  return (
    <div className={cls.join(' ')} style={sheetStyle} role="region" aria-label="Feature details">
      {/* Drag handle — rendered on mobile; hidden via CSS on desktop */}
      {!tourActive && (
        <div
          className="detail-panel-handle"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          aria-hidden="true"
        >
          <div className="detail-panel-handle-pill" />
        </div>
      )}

      {bothVisible && !tourActive && (
        <div className="detail-panel-tabs">
          <button
            className={`detail-tab${activeTab === 'park' ? ' active' : ''}`}
            onClick={() => setActiveTab('park')}
          >
            {parkName}
          </button>
          <button
            className={`detail-tab${activeTab === 'trail' ? ' active' : ''}`}
            onClick={() => setActiveTab('trail')}
          >
            <HikerIcon size={13} />
            {trailName}
          </button>
        </div>
      )}

      {parkVisible && (
        <div style={{ display: !bothVisible || activeTab === 'park' ? undefined : 'none' }}>
          <ParkDetailPanel />
        </div>
      )}

      {trailVisible && !tourActive && (
        <div style={{ display: !bothVisible || activeTab === 'trail' ? undefined : 'none' }}>
          <TrailDetailPanel />
        </div>
      )}
    </div>
  )
}
