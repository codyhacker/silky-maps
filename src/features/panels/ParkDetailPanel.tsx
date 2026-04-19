import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setSelectedFeature, setTourActive } from '../parks/interactionSlice'
import {
  IUCN_LABELS,
  IUCN_DESCRIPTIONS,
  GOV_LABELS,
  getCountry,
  formatArea,
  formatProtectionYear,
} from '../../shared/constants/parkLabels'
import { fetchParkMedia, type ParkMedia } from '../../shared/api/parkMedia'
import { ParkPlaceholderImage } from '../../shared/components/ParkPlaceholderImage'

export function ParkDetailPanel() {
  const dispatch = useAppDispatch()
  const feature  = useAppSelector(s => s.parksInteraction.selectedFeature)

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

  // Compact-view fragments derived from the same source data — keeps the chip
  // strip terse (just the year, just the area) without losing the long-form
  // text in expanded mode.
  const yearShort = (() => {
    const y = Number(feature?.STATUS_YR)
    return y && !isNaN(y) && y >= 1800 ? String(y) : null
  })()

  // Wikipedia hero + summary. `null` = pending / no data; placeholder is shown
  // either way so there's no flash of empty space.
  const [media, setMedia] = useState<ParkMedia | null>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Prefer the English Wikipedia title since we hit en.wikipedia.org.
  const wikiQuery = feature
    ? String(feature.NAME_ENG || feature.NAME || '').trim()
    : ''
  const featureKey = feature?.SITE_PID != null ? String(feature.SITE_PID) : wikiQuery

  useEffect(() => {
    setMedia(null)
    setImageFailed(false)
    setExpanded(false)
    if (!wikiQuery) return

    let cancelled = false
    fetchParkMedia(wikiQuery).then((result) => {
      if (!cancelled) setMedia(result)
    })
    return () => {
      cancelled = true
    }
  }, [featureKey, wikiQuery])

  const showImage = !!media?.imageUrl && !imageFailed
  const hasExpandableContent =
    !!iucnLabel || !!desig || !!iucnDesc || !!media?.summary || !!govLabel ||
    !!(area && area.comparison) || !!since

  // On mobile, `expanded` swaps the layout from "bottom drawer" to "transparent
  // overlay": the summary card sticks to the top, the expanded card sticks to
  // the bottom, and the live tour orbits visibly through the gap between them.
  // Tapping that gap also lets the user grab the camera (which stops the tour
  // via MapEngine's user-interaction listener).
  const panelClass = `park-detail-panel${visible ? ' visible' : ''}${expanded ? ' expanded' : ''}`

  return (
    <div className={panelClass} role="region" aria-label="Park details">
      {/* Summary card — always shown when the panel is visible. Wraps hero,
          title, country, chips, and the Full detail / Show less toggle so
          they can render as a single glass surface in the mobile-expanded
          layout. */}
      <div className="park-detail-summary">
        <div className="park-detail-hero">
          {showImage ? (
            <img
              src={media!.imageUrl!}
              alt={name}
              loading="lazy"
              onError={() => setImageFailed(true)}
              className="w-full h-full object-cover block"
            />
          ) : (
            <ParkPlaceholderImage />
          )}
        </div>

        {/* Header / meta block — title, country, and the compact stats strip
            live together inside one .park-detail-block so the mobile-expanded
            layout can render them as a single opaque card on a transparent
            panel. On desktop and mobile-collapsed the wrapper has no styling
            and the children flow exactly as before. */}
        <div className="park-detail-block">
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

          {(area || yearShort || iucnLabel) && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {area && (
                <Chip icon="📐" label={area.display} />
              )}
              {yearShort && (
                <Chip icon="🗓" label={yearShort} />
              )}
              {iucnLabel && (
                <Chip icon="🏷" label={iucnLabel} />
              )}
            </div>
          )}
        </div>

        {hasExpandableContent && (
          <button
            type="button"
            className="park-detail-toggle"
            onClick={() => {
              const next = !expanded
              setExpanded(next)
              // Expanding starts the orbit tour + flips the park to outline-only;
              // collapsing stops it. Selection changes also clear the tour
              // automatically via the slice reducer.
              dispatch(setTourActive(next))
            }}
            aria-expanded={expanded}
          >
            <span>{expanded ? 'Show less' : 'Full detail'}</span>
            <svg
              className={`park-detail-toggle-chevron${expanded ? ' open' : ''}`}
              width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}
      </div>

      {expanded && (
        <div className="park-detail-expanded mt-3 pt-3 border-t border-accent/20">
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
            <p className="park-detail-block text-xs text-[var(--text-muted)] m-0 mb-3.5 leading-relaxed">{iucnDesc}</p>
          )}

          {media?.summary && (
            <div className="park-detail-block mb-3.5">
              <p className="text-[13px] text-[var(--text-secondary)] m-0 leading-relaxed">
                {media.summary}
              </p>
              {media.wikiUrl && (
                <a
                  href={media.wikiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] underline underline-offset-2 transition-colors"
                >
                  Read more on Wikipedia →
                </a>
              )}
            </div>
          )}

          <div className="park-detail-block flex flex-col gap-2.5">
            {area && area.comparison && (
              <div className="flex items-baseline gap-2.5">
                <span className="text-sm w-5 flex-shrink-0 text-center">📐</span>
                <div>
                  <span className="text-[13px] text-[var(--text-primary)] font-medium">{area.display}</span>
                  <span className="text-[11px] text-[var(--text-muted)]"> · {area.comparison}</span>
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
      )}
    </div>
  )
}

function Chip({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-accent/12 border border-accent/20 text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
      <span aria-hidden="true" className="text-[12px] leading-none">{icon}</span>
      <span className="text-[var(--text-primary)] font-medium">{label}</span>
    </span>
  )
}
