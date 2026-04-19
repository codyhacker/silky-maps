import { clsx } from 'clsx'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setShowLegend } from '../chrome/uiSlice'
import { THEME_OPTIONS } from '../../shared/constants/themes'
import { IUCN_LABELS, GOV_LABELS, getCountry } from '../../shared/constants/parkLabels'

export function LegendPanel() {
  const dispatch       = useAppDispatch()
  const showLegend     = useAppSelector(s => s.ui.showLegend)
  const selectedTheme  = useAppSelector(s => s.mapStyle.selectedTheme)
  const hoveredFeature = useAppSelector(s => s.mapInteraction.hoveredFeature)

  const theme = THEME_OPTIONS[selectedTheme]

  const hoverName    = hoveredFeature ? String(hoveredFeature.NAME || hoveredFeature.NAME_ENG || 'Unknown') : null
  const hoverIucn    = hoveredFeature?.IUCN_CAT ? (IUCN_LABELS[hoveredFeature.IUCN_CAT as string] ?? String(hoveredFeature.IUCN_CAT)) : null
  const hoverGov     = hoveredFeature?.GOV_TYPE  ? (GOV_LABELS[hoveredFeature.GOV_TYPE as string]  ?? String(hoveredFeature.GOV_TYPE))  : null
  const hoverCountry = hoveredFeature ? getCountry(hoveredFeature.ISO3 as string | undefined) : null

  return (
    <div className={`legend-panel ${showLegend ? 'mobile-visible' : ''}`}>
      <button className="panel-close" onClick={() => dispatch(setShowLegend(false))} aria-label="Close">×</button>

      {hoveredFeature && (
        <div className="mb-3 p-3 rounded-lg bg-accent/10 border border-accent/20 animate-[pulseIn_0.3s_cubic-bezier(0.16,1,0.3,1)]">
          <h4 className="m-0 mb-1.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.5px]">Hover</h4>
          <p className="m-0 mb-1 text-[13px] font-medium text-[var(--text-primary)] animate-[textSlideIn_0.25s_ease-out]">{hoverName}</p>
          <p className="m-0 text-[11px] text-[var(--text-muted)]">
            {hoverCountry && `${hoverCountry.flag} `}
            {hoverIucn || String(hoveredFeature.DESIG_TYPE || '')}
            {hoverGov && ` · ${hoverGov}`}
          </p>
        </div>
      )}

      <h3 className="m-0 mb-1 text-sm font-semibold text-[var(--text-light)]">Legend</h3>
      <p className="m-0 mb-3 text-[11px] text-[var(--text-muted)] pb-2.5 border-b border-accent/20">
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
              'flex items-center gap-2.5 mb-1.5',
              'animate-[fadeInUp_0.3s_cubic-bezier(0.16,1,0.3,1)_backwards]',
              'transition-transform duration-200 hover:translate-x-1 group'
            )}
          >
            <span
              className="w-3.5 h-3.5 rounded-[4px] flex-shrink-0 transition-all duration-200 group-hover:scale-125 group-hover:shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
              style={{ backgroundColor: color }}
            />
            <span className="text-[11px] text-[var(--text-secondary)] whitespace-nowrap overflow-hidden text-ellipsis" title={label}>
              {display}
            </span>
          </div>
        )
      })}
    </div>
  )
}
