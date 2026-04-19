import { useMemo } from 'react'
import { clsx } from 'clsx'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setShowLegend, toggleLegendCollapsed } from '../shell/uiSlice'
import { buildThemeOptions } from '../../shared/constants/dataPalettes'
import { getUiTheme } from '../../shared/constants/uiThemes'
import { IUCN_LABELS, GOV_LABELS, getCountry } from '../../shared/constants/parkLabels'

export function LegendPanel() {
  const dispatch        = useAppDispatch()
  const showLegend      = useAppSelector(s => s.ui.showLegend)
  const legendCollapsed = useAppSelector(s => s.ui.legendCollapsed)
  const selectedTheme   = useAppSelector(s => s.mapStyle.selectedTheme)
  const selectedUiTheme = useAppSelector(s => s.mapStyle.selectedUiTheme)
  const hoveredFeature  = useAppSelector(s => s.parksInteraction.hoveredFeature)

  // Themed swatches: the data palette is owned by the active UI theme so
  // changing the chrome also reskins the legend swatches and the parks layer
  // in lockstep.
  const themeOptions = useMemo(
    () => buildThemeOptions(getUiTheme(selectedUiTheme).palette.dataPalette),
    [selectedUiTheme],
  )
  const theme = themeOptions[selectedTheme]

  const hoverName    = hoveredFeature ? String(hoveredFeature.NAME || hoveredFeature.NAME_ENG || 'Unknown') : null
  const hoverIucn    = hoveredFeature?.IUCN_CAT ? (IUCN_LABELS[hoveredFeature.IUCN_CAT as string] ?? String(hoveredFeature.IUCN_CAT)) : null
  const hoverGov     = hoveredFeature?.GOV_TYPE  ? (GOV_LABELS[hoveredFeature.GOV_TYPE as string]  ?? String(hoveredFeature.GOV_TYPE))  : null
  const hoverCountry = hoveredFeature ? getCountry(hoveredFeature.ISO3 as string | undefined) : null

  const panelClass = clsx(
    'legend-panel',
    showLegend && 'mobile-visible',
    legendCollapsed && 'collapsed',
  )

  return (
    <div className={panelClass}>
      <button className="panel-close" onClick={() => dispatch(setShowLegend(false))} aria-label="Close">×</button>

      {/* Toggle header — clickable on desktop to collapse/expand. On mobile
          this still works but the collapsed CSS is desktop-scoped so the
          content always renders when the panel is shown via MobileToggles. */}
      <button
        type="button"
        className="legend-toggle"
        onClick={() => dispatch(toggleLegendCollapsed())}
        aria-expanded={!legendCollapsed}
        aria-label={legendCollapsed ? 'Expand legend' : 'Collapse legend'}
      >
        <span className="legend-toggle-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9.5" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <circle cx="12" cy="7.5" r="0.5" fill="currentColor" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          <span>Legend</span>
        </span>
        <svg className="legend-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div className="legend-content">
        {hoveredFeature && (
          <div className="mb-3 p-2.5 rounded-lg bg-accent/10 border border-accent/20 animate-[pulseIn_0.3s_cubic-bezier(0.16,1,0.3,1)]">
            <h4 className="m-0 mb-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.5px]">Hover</h4>
            <p className="m-0 mb-1 text-[12px] font-medium text-[var(--text-primary)] animate-[textSlideIn_0.25s_ease-out]">{hoverName}</p>
            <p className="m-0 text-[10px] text-[var(--text-muted)]">
              {hoverCountry && `${hoverCountry.flag} `}
              {hoverIucn || String(hoveredFeature.DESIG_TYPE || '')}
              {hoverGov && ` · ${hoverGov}`}
            </p>
          </div>
        )}

        <p className="m-0 mb-2 text-[10px] text-[var(--text-muted)] uppercase tracking-[0.4px]">
          {theme.label}
        </p>

        {Object.entries(theme.colors).map(([label, color]) => {
          const display = theme.property === 'IUCN_CAT'
            ? (IUCN_LABELS[label] ?? label)
            : theme.property === 'GOV_TYPE'
              ? (GOV_LABELS[label] ?? label)
              : label
          return (
            <div
              key={label}
              className={clsx(
                'legend-item',
                'flex items-center gap-2 mb-1',
                'animate-[fadeInUp_0.3s_cubic-bezier(0.16,1,0.3,1)_backwards]',
                'transition-transform duration-200 hover:translate-x-1 group'
              )}
            >
              <span
                className="w-3 h-3 rounded-[3px] flex-shrink-0 transition-all duration-200 group-hover:scale-125 group-hover:shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
                style={{ backgroundColor: color }}
              />
              <span className="text-[11px] text-[var(--text-secondary)] whitespace-nowrap overflow-hidden text-ellipsis" title={label}>
                {display}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
