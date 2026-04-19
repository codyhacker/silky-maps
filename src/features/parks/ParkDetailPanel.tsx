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
  const feature = useAppSelector(s => s.mapInteraction.selectedFeature)

  const visible = feature !== null

  const name = feature
    ? String(feature.NAME || feature.NAME_ENG || 'Unknown Park')
    : ''

  const country = feature ? getCountry(feature.ISO3 as string | undefined) : null
  const iucnKey = feature?.IUCN_CAT as string | undefined
  const iucnLabel = iucnKey ? (IUCN_LABELS[iucnKey] ?? iucnKey) : null
  const iucnDesc  = iucnKey ? IUCN_DESCRIPTIONS[iucnKey] : null
  const govLabel  = feature?.GOV_TYPE ? (GOV_LABELS[feature.GOV_TYPE as string] ?? String(feature.GOV_TYPE)) : null
  const desig     = feature?.DESIG as string | undefined
  const area      = feature?.REP_AREA != null ? formatArea(Number(feature.REP_AREA)) : null
  const since     = feature?.STATUS_YR ? formatProtectionYear(feature.STATUS_YR as string | number) : null

  return (
    <div className={`park-detail-panel${visible ? ' visible' : ''}`} role="region" aria-label="Park details">
      <div className="park-detail-header">
        <h2 className="park-detail-name">{name}</h2>
        <button
          className="park-detail-close"
          onClick={() => dispatch(setSelectedFeature(null))}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {country && (
        <p className="park-detail-country">
          {country.flag} {country.name}
        </p>
      )}

      <div className="park-detail-divider" />

      <div className="park-detail-badges">
        {iucnLabel && <span className="park-detail-badge">{iucnLabel}</span>}
        {desig && desig !== iucnLabel && <span className="park-detail-badge">{desig}</span>}
      </div>

      {iucnDesc && (
        <p className="park-detail-iucn-desc">{iucnDesc}</p>
      )}

      <div className="park-detail-stats">
        {area && (
          <div className="park-detail-stat">
            <span className="park-detail-stat-icon">📐</span>
            <div>
              <span className="park-detail-stat-main">{area.display}</span>
              {area.comparison && (
                <span className="park-detail-stat-sub"> · {area.comparison}</span>
              )}
            </div>
          </div>
        )}

        {since && (
          <div className="park-detail-stat">
            <span className="park-detail-stat-icon">🗓</span>
            <span className="park-detail-stat-main">{since}</span>
          </div>
        )}

        {govLabel && (
          <div className="park-detail-stat">
            <span className="park-detail-stat-icon">🏛</span>
            <span className="park-detail-stat-main">{govLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
}
