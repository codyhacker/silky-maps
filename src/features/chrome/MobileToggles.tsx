import { clsx } from 'clsx'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setShowControls, setShowLegend, closeMobilePanels } from './uiSlice'

export function MobileToggles() {
  const dispatch     = useAppDispatch()
  const showControls = useAppSelector(s => s.ui.showControls)
  const showLegend   = useAppSelector(s => s.ui.showLegend)

  const base = clsx(
    'w-12 h-12 max-[480px]:w-11 max-[480px]:h-11',
    'rounded-full flex items-center justify-center cursor-pointer',
    'border border-accent/40',
    'shadow-[0_4px_20px_rgba(0,0,0,0.5)]',
    'transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
    'active:scale-95'
  )

  return (
    <>
      <div className="mobile-toggles">
        <button
          className={clsx(base, showLegend
            ? 'bg-active-gradient border-[var(--active-border)] text-white animate-[toggleActivate_0.3s_cubic-bezier(0.16,1,0.3,1)]'
            : 'bg-surface/95 text-[var(--text-secondary)] hover:bg-surface-2/98 hover:scale-[1.08]'
          )}
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
          className={clsx(base, showControls
            ? 'bg-active-gradient border-[var(--active-border)] text-white animate-[toggleActivate_0.3s_cubic-bezier(0.16,1,0.3,1)]'
            : 'bg-surface/95 text-[var(--text-secondary)] hover:bg-surface-2/98 hover:scale-[1.08]'
          )}
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
