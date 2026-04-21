import { useState, useEffect } from 'react'
import { useAppSelector } from '../../app/hooks'
import { ParkDetailPanel } from './ParkDetailPanel'
import { TrailDetailPanel } from './TrailDetailPanel'
import { HikerIcon } from '../../shared/components/HikerIcon'

type Tab = 'park' | 'trail'

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

  return (
    <div className={cls.join(' ')} role="region" aria-label="Feature details">
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
