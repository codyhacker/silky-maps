import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setShowLegend } from '../chrome/uiSlice'
import { THEME_OPTIONS } from '../../shared/constants/themes'
import { IUCN_LABELS, GOV_LABELS, getCountry } from '../../shared/constants/parkLabels'

export function LegendPanel() {
  const dispatch = useAppDispatch()
  const showLegend     = useAppSelector(s => s.ui.showLegend)
  const selectedTheme  = useAppSelector(s => s.mapStyle.selectedTheme)
  const hoveredFeature = useAppSelector(s => s.mapInteraction.hoveredFeature)

  const theme = THEME_OPTIONS[selectedTheme]

  const hoverName   = hoveredFeature ? String(hoveredFeature.NAME || hoveredFeature.NAME_ENG || 'Unknown') : null
  const hoverIucn   = hoveredFeature?.IUCN_CAT ? (IUCN_LABELS[hoveredFeature.IUCN_CAT as string] ?? String(hoveredFeature.IUCN_CAT)) : null
  const hoverGov    = hoveredFeature?.GOV_TYPE  ? (GOV_LABELS[hoveredFeature.GOV_TYPE as string]  ?? String(hoveredFeature.GOV_TYPE))  : null
  const hoverCountry = hoveredFeature ? getCountry(hoveredFeature.ISO3 as string | undefined) : null

  return (
    <div className={`legend-panel ${showLegend ? 'mobile-visible' : ''}`}>
      <button className="panel-close" onClick={() => dispatch(setShowLegend(false))} aria-label="Close">×</button>

      {hoveredFeature && (
        <div className="hover-info hover-info-top">
          <h4>Hover</h4>
          <p className="hover-name">{hoverName}</p>
          <p className="hover-detail">
            {hoverCountry && `${hoverCountry.flag} `}
            {hoverIucn || String(hoveredFeature.DESIG_TYPE || '')}
            {hoverGov && ` · ${hoverGov}`}
          </p>
        </div>
      )}

      <h3>Legend</h3>
      <p className="legend-subtitle">{theme.label}</p>
      {Object.entries(theme.colors).map(([label, color]) => {
        const display = theme.property === 'IUCN_CAT'
          ? (IUCN_LABELS[label] ?? label)
          : theme.property === 'GOV_TYPE'
            ? (GOV_LABELS[label] ?? label)
            : label
        return (
          <div key={label} className="legend-item">
            <span className="legend-swatch" style={{ backgroundColor: color }} />
            <span className="legend-label" title={label}>{display}</span>
          </div>
        )
      })}
    </div>
  )
}
