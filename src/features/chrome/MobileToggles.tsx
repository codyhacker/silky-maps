import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setShowControls, setShowLegend, closeMobilePanels } from './uiSlice'

export function MobileToggles() {
  const dispatch = useAppDispatch()
  const showControls = useAppSelector(s => s.ui.showControls)
  const showLegend = useAppSelector(s => s.ui.showLegend)

  return (
    <>
      <div className="mobile-toggles">
        <button
          className={`mobile-toggle ${showLegend ? 'active' : ''}`}
          onClick={() => { dispatch(setShowLegend(!showLegend)); dispatch(setShowControls(false)) }}
          aria-label="Toggle legend"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </button>
        <button
          className={`mobile-toggle ${showControls ? 'active' : ''}`}
          onClick={() => { dispatch(setShowControls(!showControls)); dispatch(setShowLegend(false)) }}
          aria-label="Toggle controls"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
          </svg>
        </button>
      </div>

      {(showControls || showLegend) && (
        <div className="mobile-overlay" onClick={() => dispatch(closeMobilePanels())} />
      )}
    </>
  )
}
