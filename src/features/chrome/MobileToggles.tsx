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
          {/* Info circle — the legend panel is a read-only info surface
              (color key + hover details), so the "ⓘ" glyph reads correctly
              as "look here, not tweak here" and stays shape-orthogonal to
              the sliders icon on the controls button. */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9.5" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <circle cx="12" cy="7.5" r="0.5" fill="currentColor" stroke="currentColor" strokeWidth="1.6" />
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
          {/* Horizontal sliders — universal "settings / tunables" glyph and
              mirrors the actual Opacity / Terrain sliders inside the panel. */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6"  x2="20" y2="6"  />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
            <circle cx="15" cy="6"  r="2.2" fill="currentColor" stroke="none" />
            <circle cx="9"  cy="12" r="2.2" fill="currentColor" stroke="none" />
            <circle cx="17" cy="18" r="2.2" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </div>

      {(showControls || showLegend) && (
        <div className="mobile-overlay" onClick={() => dispatch(closeMobilePanels())} />
      )}
    </>
  )
}
