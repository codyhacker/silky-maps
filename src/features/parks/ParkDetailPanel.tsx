import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setSelectedFeature } from '../map-core/mapInteractionSlice'
import {
  IUCN_LABELS,
  IUCN_DESCRIPTIONS,
  GOV_LABELS,
  getCountry,
  formatArea,
  formatProtectionYear,
} from '../../shared/constants/parkLabels'

export function ParkDetailPanel() {
  const dispatch = useAppDispatch()
  const feature  = useAppSelector(s => s.mapInteraction.selectedFeature)

  const visible = feature !== null
  const name    = feature ? String(feature.NAME || feature.NAME_ENG || 'Unknown Park') : ''

  const country   = feature ? getCountry(feature.ISO3 as string | undefined) : null
  const iucnKey   = feature?.IUCN_CAT as string | undefined
  const iucnLabel = iucnKey ? (IUCN_LABELS[iucnKey] ?? iucnKey) : null
  const iucnDesc  = iucnKey ? IUCN_DESCRIPTIONS[iucnKey] : null
  const govLabel  = feature?.GOV_TYPE ? (GOV_LABELS[feature.GOV_TYPE as string] ?? String(feature.GOV_TYPE)) : null
  const desig     = feature?.DESIG as string | undefined
  const area      = feature?.REP_AREA != null ? formatArea(Number(feature.REP_AREA)) : null
  const since     = feature?.STATUS_YR ? formatProtectionYear(feature.STATUS_YR as string | number) : null

  return (
    <div className={`park-detail-panel${visible ? ' visible' : ''}`} role="region" aria-label="Park details">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="text-[17px] font-bold text-[var(--text-primary)] leading-snug flex-1 m-0">{name}</h2>
        <button
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border-0 cursor-pointer text-lg leading-none transition-all duration-150 bg-accent/15 text-[var(--text-muted)] hover:bg-accent/30 hover:text-[var(--text-primary)]"
          onClick={() => dispatch(setSelectedFeature(null))}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {country && (
        <p className="text-[13px] text-[var(--text-secondary)] m-0">
          {country.flag} {country.name}
        </p>
      )}

      <div className="h-px bg-accent/20 my-3.5" />

      {(iucnLabel || desig) && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {iucnLabel && (
            <span className="px-2.5 py-1 rounded-xl text-[11px] text-[var(--text-secondary)] bg-accent/15 border border-accent/25">
              {iucnLabel}
            </span>
          )}
          {desig && desig !== iucnLabel && (
            <span className="px-2.5 py-1 rounded-xl text-[11px] text-[var(--text-secondary)] bg-accent/15 border border-accent/25">
              {desig}
            </span>
          )}
        </div>
      )}

      {iucnDesc && (
        <p className="text-xs text-[var(--text-muted)] m-0 mb-3.5 leading-relaxed">{iucnDesc}</p>
      )}

      <div className="flex flex-col gap-2.5">
        {area && (
          <div className="flex items-baseline gap-2.5">
            <span className="text-sm w-5 flex-shrink-0 text-center">📐</span>
            <div>
              <span className="text-[13px] text-[var(--text-primary)] font-medium">{area.display}</span>
              {area.comparison && (
                <span className="text-[11px] text-[var(--text-muted)]"> · {area.comparison}</span>
              )}
            </div>
          </div>
        )}
        {since && (
          <div className="flex items-baseline gap-2.5">
            <span className="text-sm w-5 flex-shrink-0 text-center">🗓</span>
            <span className="text-[13px] text-[var(--text-primary)] font-medium">{since}</span>
          </div>
        )}
        {govLabel && (
          <div className="flex items-baseline gap-2.5">
            <span className="text-sm w-5 flex-shrink-0 text-center">🏛</span>
            <span className="text-[13px] text-[var(--text-primary)] font-medium">{govLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
}
