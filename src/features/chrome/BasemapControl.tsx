import { clsx } from 'clsx'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setShowBasemapMenu } from './uiSlice'
import { setSelectedBasemap } from '../parks/mapStyleSlice'
import { BASEMAP_OPTIONS } from '../../shared/constants/basemaps'

export function BasemapControl() {
  const dispatch      = useAppDispatch()
  const showBasemapMenu = useAppSelector(s => s.ui.showBasemapMenu)
  const selectedBasemap = useAppSelector(s => s.mapStyle.selectedBasemap)

  return (
    <div className="basemap-control">
      <button
        className={clsx(
          'w-[29px] h-[29px] max-md:w-10 max-md:h-10',
          'flex items-center justify-center rounded-lg border cursor-pointer',
          'shadow-[0_2px_12px_rgba(0,0,0,0.4)]',
          'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
          showBasemapMenu
            ? 'bg-active-gradient border-[var(--active-border)] text-white'
            : 'bg-surface/90 border-accent/30 text-[var(--text-secondary)] hover:bg-surface-2/95 hover:border-accent/50 hover:scale-105'
        )}
        onClick={() => dispatch(setShowBasemapMenu(!showBasemapMenu))}
        aria-label="Change basemap"
        title="Change basemap"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      </button>

      {showBasemapMenu && (
        <div className={clsx(
          'absolute right-0',
          'min-w-[140px] max-md:min-w-[160px]',
          // Desktop: opens downward; mobile: opens upward
          'md:top-full md:mt-2 max-md:bottom-full max-md:mb-2',
          'bg-panel-dark backdrop-blur-[12px]',
          'border border-accent/30 rounded-[10px] p-1.5',
          'shadow-[0_8px_32px_rgba(0,0,0,0.5)]',
          'animate-[menuSlideIn_0.2s_cubic-bezier(0.16,1,0.3,1)]'
        )}>
          {BASEMAP_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              className={clsx(
                'block w-full text-left rounded-md border-0 cursor-pointer',
                'px-3.5 py-2.5 text-xs max-md:px-4 max-md:py-3.5 max-md:text-sm',
                'font-[system-ui,-apple-system,sans-serif]',
                'transition-all duration-150',
                selectedBasemap === opt.id
                  ? 'bg-active-gradient text-white shadow-[0_2px_8px_rgba(var(--active-rgb),0.4)]'
                  : 'bg-transparent text-[var(--text-secondary)] hover:bg-accent/20 hover:text-[var(--text-primary)]'
              )}
              onClick={() => {
                dispatch(setSelectedBasemap(opt.id))
                dispatch(setShowBasemapMenu(false))
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
