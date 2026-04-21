import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setSelectedFeature, setTourActive } from '../parks/interactionSlice'
import { addFavorite, removeFavorite } from '../favorites/favoritesSlice'
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
  const observed = useAppSelector(s => s.camera.observed)
  const favorites = useAppSelector(s => s.favorites.entries)

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

  const yearShort = (() => {
    const y = Number(feature?.STATUS_YR)
    return y && !isNaN(y) && y >= 1800 ? String(y) : null
  })()

  const [media, setMedia] = useState<ParkMedia | null>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const wikiQuery  = feature ? String(feature.NAME_ENG || feature.NAME || '').trim() : ''
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
    return () => { cancelled = true }
  }, [featureKey, wikiQuery])

  const showImage = !!media?.imageUrl && !imageFailed
  const hasExpandableContent =
    !!iucnLabel || !!desig || !!iucnDesc || !!media?.summary || !!govLabel ||
    !!(area && area.comparison) || !!since

  const featureId = feature?.SITE_PID != null ? String(feature.SITE_PID) : null
  const isFavorited = featureId !== null && favorites.some(e => e.id === featureId)

  function handleToggle() {
    const next = !expanded
    setExpanded(next)
    dispatch(setTourActive(next))
  }

  function handleSave() {
    if (!feature) return
    if (isFavorited && featureId) {
      dispatch(removeFavorite(featureId))
    } else if (observed) {
      dispatch(addFavorite({ feature, camera: observed }))
    }
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!visible) return null

  return (
    <div className="park-content-wrapper">
      <div className="park-detail-summary">

        {/* Hero image with name/country overlay */}
        <div className="park-detail-hero relative">
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

          {/* Name + country overlay — gradient fade from bottom */}
          <div className="absolute inset-x-0 bottom-0 px-3 pt-8 pb-2.5 bg-gradient-to-t from-black/75 via-black/30 to-transparent pointer-events-none">
            <h2 className="text-[16px] font-bold text-white leading-snug m-0 drop-shadow-sm">{name}</h2>
            {country && (
              <p className="text-[12px] text-white/80 m-0 mt-0.5">{country.flag} {country.name}</p>
            )}
          </div>

          {/* Close button — top right corner of hero */}
          <button
            className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center border-0 cursor-pointer text-lg leading-none transition-all duration-150 bg-black/40 backdrop-blur-sm text-white/80 hover:bg-black/65 hover:text-white"
            onClick={() => dispatch(setSelectedFeature(null))}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Card body below hero */}
        <div className="park-detail-block">

          {/* Name fallback — shown only in expanded mode (hero is hidden) */}
          {expanded && (
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-[16px] font-bold text-[var(--text-primary)] leading-snug m-0">{name}</h2>
                {country && (
                  <p className="text-[13px] text-[var(--text-secondary)] m-0 mt-0.5">{country.flag} {country.name}</p>
                )}
              </div>
              <button
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border-0 cursor-pointer text-lg leading-none transition-all duration-150 bg-accent/15 text-[var(--text-muted)] hover:bg-accent/30 hover:text-[var(--text-primary)]"
                onClick={() => dispatch(setSelectedFeature(null))}
                aria-label="Close"
              >
                ×
              </button>
            </div>
          )}

          {/* 3-col stat tile grid — hidden in expanded (tour) mode */}
          {!expanded && (area || yearShort || iucnLabel) && (
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              <StatTile icon="📐" label="Area"      value={area?.display ?? '—'} />
              <StatTile icon="🗓" label="Protected" value={yearShort ?? '—'} />
              <StatTile icon="🏷" label="IUCN"      value={iucnLabel ?? '—'} />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {hasExpandableContent && (
              <button
                type="button"
                className="flex-1 park-detail-toggle"
                onClick={handleToggle}
                aria-expanded={expanded}
              >
                <span>{expanded ? 'Show less' : 'Full details →'}</span>
              </button>
            )}
            <button
              type="button"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-accent/20 bg-accent/8 text-base cursor-pointer transition-all duration-150 hover:bg-accent/20 hover:border-accent/40 flex-shrink-0"
              style={{ color: isFavorited ? 'var(--accent)' : 'var(--text-muted)' }}
              aria-label={isFavorited ? 'Remove from favourites' : 'Save to favourites'}
              onClick={handleSave}
            >
              {isFavorited ? '♥' : '♡'}
            </button>
            <button
              type="button"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-accent/20 bg-accent/8 text-[var(--text-muted)] text-base cursor-pointer transition-all duration-150 hover:bg-accent/20 hover:text-[var(--text-secondary)] hover:border-accent/40 flex-shrink-0"
              aria-label="Share"
              onClick={handleShare}
              title={copied ? 'Link copied!' : 'Copy share link'}
            >
              {copied ? '✓' : '⤴'}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded detail section */}
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

function StatTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg bg-accent/10 border border-accent/15">
      <span className="text-[13px] leading-none" aria-hidden="true">{icon}</span>
      <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.3px]">{label}</span>
      <span className="text-[11px] font-semibold text-[var(--text-primary)] text-center leading-tight">{value}</span>
    </div>
  )
}
