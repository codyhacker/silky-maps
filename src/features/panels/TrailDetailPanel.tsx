import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import {
  setSelectedTrail,
  setFlyAlongActive,
  setFlyAlongPaused,
  setFlyAlongProgress,
} from '../trails/interactionSlice'
import { useMapEngine } from '../map/engine/MapEngineContext'
import { getUiTheme, getEffectivePalette } from '../../shared/constants/uiThemes'

export function TrailDetailPanel() {
  const dispatch = useAppDispatch()
  const engine = useMapEngine()

  const props            = useAppSelector(s => s.trailsInteraction.selectedTrailProps)
  const trailId          = useAppSelector(s => s.trailsInteraction.selectedTrailId)
  const flyAlongActive   = useAppSelector(s => s.trailsInteraction.flyAlongActive)
  const flyAlongPaused   = useAppSelector(s => s.trailsInteraction.flyAlongPaused)
  const flyAlongProgress = useAppSelector(s => s.trailsInteraction.flyAlongProgress)
  const selectedUiTheme  = useAppSelector(s => s.mapStyle.selectedUiTheme)
  const uiMode           = useAppSelector(s => s.mapStyle.uiMode)

  const visible = props !== null && trailId !== null
  const palette = useMemo(
    () => getEffectivePalette(getUiTheme(selectedUiTheme), uiMode),
    [selectedUiTheme, uiMode],
  )

  const name =
    (props?.name as string | undefined) ||
    (props?.ref  as string | undefined) ||
    'Unnamed trail'

  // 120 samples — finer source data for the Catmull-Rom curve.
  const [profile, setProfile] = useState<ReturnType<typeof engine.getSelectedTrailProfile>>(null)
  useEffect(() => {
    setProfile(null)
    if (!visible) return
    let cancelled = false
    let attempts  = 0
    function tryFetch(): void {
      if (cancelled) return
      const next = engine.getSelectedTrailProfile(120)
      if (next) { setProfile(next); return }
      if (attempts++ < 8) setTimeout(tryFetch, 300)
    }
    tryFetch()
    return () => { cancelled = true }
  }, [visible, trailId, engine])

  // Current elevation interpolated from the profile at the fly-along position.
  const currentElevM = useMemo(() => {
    if (!flyAlongActive || !profile?.elevations?.length) return null
    const arr = profile.elevations
    const idx = flyAlongProgress * (arr.length - 1)
    const lo  = Math.floor(idx)
    const hi  = Math.min(Math.ceil(idx), arr.length - 1)
    return Math.round(arr[lo] + (arr[hi] - arr[lo]) * (idx - lo))
  }, [flyAlongActive, flyAlongProgress, profile])

  if (!visible) return null

  const lengthKm   = profile?.lengthKm ?? (props?.length_km as number | undefined) ?? null
  const gainM      = profile?.gainM ?? null
  const surface    = (props?.surface    as string | undefined) ?? '—'
  const difficulty = (props?.difficulty as string | undefined) ?? '—'
  const insidePark = props?.inside_park as string | number | undefined

  const coveredKm = flyAlongActive && lengthKm != null
    ? flyAlongProgress * lengthKm
    : null

  function handleFlyAlongStart(): void {
    dispatch(setFlyAlongPaused(false))
    dispatch(setFlyAlongActive(true))
  }
  function handleFlyAlongStop(): void {
    dispatch(setFlyAlongActive(false))
  }
  function handlePauseResume(): void {
    dispatch(setFlyAlongPaused(!flyAlongPaused))
  }
  function handleClose(): void {
    dispatch(setSelectedTrail(null))
  }

  // Chart scrub callbacks — dispatching progress while paused moves the
  // hiker marker in the engine's RAF loop without advancing time.
  function handleScrubStart(t: number): void {
    dispatch(setFlyAlongPaused(true))
    dispatch(setFlyAlongProgress(t))
  }
  function handleScrub(t: number): void {
    dispatch(setFlyAlongProgress(t))
  }

  return (
    <div className="trail-detail-summary">

        {/* Hero — elevation profile, expands during fly-along */}
        <div className={`trail-detail-hero${flyAlongActive ? ' trail-detail-hero--flyalong' : ''} relative`}>
          <ElevationProfile
            elevations={profile?.elevations ?? null}
            stroke={palette.mapTrail}
            fill={palette.mapTrail}
            casing={palette.mapTrailCasing}
            flyAlongProgress={flyAlongActive ? flyAlongProgress : undefined}
            flyAlongPaused={flyAlongPaused}
            onScrubStart={flyAlongActive ? handleScrubStart : undefined}
            onScrub={flyAlongActive ? handleScrub : undefined}
          />
          <div className="absolute inset-x-0 bottom-0 px-3 pt-8 pb-2.5 bg-gradient-to-t from-black/65 via-black/25 to-transparent pointer-events-none">
            <h2 className="text-[16px] font-bold text-white leading-snug m-0 drop-shadow-sm">{name}</h2>
            {props?.ref && props.ref !== name && (
              <p className="text-[12px] text-white/80 m-0 mt-0.5">{String(props.ref)}</p>
            )}
          </div>
          <button
            className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center border-0 cursor-pointer text-lg leading-none transition-all duration-150 bg-black/40 backdrop-blur-sm text-white/80 hover:bg-black/65 hover:text-white"
            onClick={handleClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Fly-along progress readout — visible only during active tour */}
        {flyAlongActive && (
          <div className="trail-flyalong-hud">
            <span className="trail-flyalong-stat">
              <span className="trail-flyalong-stat-val">
                {coveredKm != null ? coveredKm.toFixed(1) : '—'}
              </span>
              <span className="trail-flyalong-stat-label">km elapsed</span>
            </span>
            {currentElevM != null && (
              <span className="trail-flyalong-stat">
                <span className="trail-flyalong-stat-val">{currentElevM}</span>
                <span className="trail-flyalong-stat-label">m elev</span>
              </span>
            )}
            <span className="trail-flyalong-stat">
              <span className="trail-flyalong-stat-val">
                {Math.round((1 - flyAlongProgress) * 100)}%
              </span>
              <span className="trail-flyalong-stat-label">remaining</span>
            </span>
          </div>
        )}

        {/* Card body */}
        <div className="trail-detail-block">
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            <StatTile icon="↔" label="Length"  value={lengthKm != null ? `${lengthKm.toFixed(1)} km` : '—'} />
            <StatTile icon="▲" label="Gain"    value={gainM != null ? `${Math.round(gainM)} m` : '—'} />
            <StatTile icon="⛏" label="Surface" value={cap(surface)} />
            <StatTile icon="◆" label="Grade"   value={cap(difficulty)} />
          </div>

          {insidePark != null && (
            <p className="text-[10px] text-[var(--text-muted)] mb-3 uppercase tracking-[0.3px]">
              Inside protected area · {String(insidePark)}
            </p>
          )}

          <div className="flex gap-2">
            {flyAlongActive ? (
              <>
                <button
                  type="button"
                  className="flex-1 trail-detail-toggle"
                  onClick={handlePauseResume}
                  aria-pressed={flyAlongPaused}
                >
                  <span>{flyAlongPaused ? '▶ Resume' : '⏸ Pause'}</span>
                </button>
                <button
                  type="button"
                  className="trail-detail-toggle"
                  onClick={handleFlyAlongStop}
                >
                  <span>■ Stop</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                className="flex-1 trail-detail-toggle"
                onClick={handleFlyAlongStart}
                aria-pressed={false}
              >
                <span>Fly along →</span>
              </button>
            )}
          </div>
        </div>

      </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg bg-accent/10 border border-accent/15">
      <span className="text-[13px] leading-none" aria-hidden="true">{icon}</span>
      <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.3px]">{label}</span>
      <span className="text-[11px] font-semibold text-[var(--text-primary)] text-center leading-tight">{value}</span>
    </div>
  )
}

function cap(s: string): string {
  if (!s || s === '—') return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── Elevation profile SVG ────────────────────────────────────────────────────
//
// Renders as a Catmull-Rom spline (smooth cubic bezier through every sampled
// point) rather than a polyline so the profile reads as a terrain silhouette
// rather than a jagged staircase. The curve passes through actual data — no
// smoothing window averages away real elevation features.
//
// During fly-along the component is interactive: pointer events let the user
// pause and scrub the marker position via the chart.

const PROFILE_W    = 320
const PROFILE_H    = 140   // default (static view)
const PROFILE_H_FA = 180   // expanded during fly-along
const PAD_TOP      = 20
const PAD_BOTTOM   = 8
const PAD_LEFT     = 8     // left inset so the elevation label has space

function catmullRomPath(pts: readonly [number, number][]): string {
  if (pts.length < 2) return ''
  const n = pts.length
  // Clamp index so first/last segments reflect at the boundary.
  const p = (i: number): [number, number] => pts[Math.max(0, Math.min(n - 1, i))]
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = p(i - 1)
    const [x1, y1] = p(i)
    const [x2, y2] = p(i + 1)
    const [x3, y3] = p(i + 2)
    const cp1x = x1 + (x2 - x0) / 6
    const cp1y = y1 + (y2 - y0) / 6
    const cp2x = x2 - (x3 - x1) / 6
    const cp2y = y2 - (y3 - y1) / 6
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)},${cp2x.toFixed(1)} ${cp2y.toFixed(1)},${x2.toFixed(1)} ${y2.toFixed(1)}`
  }
  return d
}

interface ElevationProfileProps {
  elevations: number[] | null
  stroke: string
  fill: string
  casing: string
  flyAlongProgress?: number
  flyAlongPaused?: boolean
  onScrubStart?: (t: number) => void
  onScrub?: (t: number) => void
}

function ElevationProfile({
  elevations,
  stroke,
  fill,
  casing,
  flyAlongProgress,
  flyAlongPaused,
  onScrubStart,
  onScrub,
}: ElevationProfileProps) {
  const svgRef     = useRef<SVGSVGElement>(null)
  const [hoverT, setHoverT] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const interactive = onScrubStart != null
  const h = flyAlongProgress !== undefined ? PROFILE_H_FA : PROFILE_H

  function tFromPointer(e: React.PointerEvent): number {
    if (!svgRef.current) return 0
    const rect = svgRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>): void {
    if (!interactive) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    const t = tFromPointer(e)
    setHoverT(t)
    onScrubStart!(t)
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>): void {
    if (!interactive) return
    const t = tFromPointer(e)
    setHoverT(t)
    if (dragging) onScrub?.(t)
  }

  function handlePointerUp(e: React.PointerEvent<SVGSVGElement>): void {
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
  }

  function handlePointerLeave(): void {
    if (!dragging) setHoverT(null)
  }

  // Placeholder when elevations aren't available yet.
  if (!elevations || elevations.length === 0 || elevations.every(e => e === 0)) {
    return (
      <svg
        viewBox={`0 0 ${PROFILE_W} ${h}`}
        preserveAspectRatio="none"
        width="100%" height="100%"
        style={{ display: 'block', background: casing }}
      >
        <line
          x1={0} x2={PROFILE_W} y1={h * 0.7} y2={h * 0.7}
          stroke={stroke} strokeWidth={1.5} strokeOpacity={0.6} strokeDasharray="3 4"
        />
      </svg>
    )
  }

  const min   = Math.min(...elevations)
  const max   = Math.max(...elevations)
  const range = Math.max(max - min, 1)
  const plotH = h - PAD_TOP - PAD_BOTTOM
  const plotW = PROFILE_W - PAD_LEFT

  const points: [number, number][] = elevations.map((e, i) => [
    PAD_LEFT + (i / (elevations.length - 1)) * plotW,
    PAD_TOP  + plotH - ((e - min) / range) * plotH,
  ])

  const linePath = catmullRomPath(points)
  const areaPath = `${linePath} L ${PROFILE_W} ${h} L ${PAD_LEFT} ${h} Z`

  // Interpolate y at arbitrary t for scrubber/hover dots.
  function yAtT(t: number): number {
    const idx = t * (elevations!.length - 1)
    const lo  = Math.floor(idx)
    const hi  = Math.min(Math.ceil(idx), elevations!.length - 1)
    const e   = elevations![lo] + (elevations![hi] - elevations![lo]) * (idx - lo)
    return PAD_TOP + plotH - ((e - min) / range) * plotH
  }

  const scrubX = flyAlongProgress !== undefined
    ? PAD_LEFT + flyAlongProgress * plotW
    : null

  const hoverX = hoverT !== null
    ? PAD_LEFT + hoverT * plotW
    : null

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${PROFILE_W} ${h}`}
      preserveAspectRatio="none"
      width="100%" height="100%"
      style={{ display: 'block', background: casing, cursor: interactive ? 'crosshair' : 'default' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      <path d={areaPath} fill={fill} fillOpacity={0.22} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={1.8}
            strokeLinejoin="round" strokeLinecap="round" />

      {/* Elevation range — top-left, clear of the × close button */}
      <text
        x={PAD_LEFT + 2} y={PAD_TOP - 5}
        textAnchor="start" fill="rgba(255,255,255,0.85)"
        fontSize="9" fontFamily="'Geologica Variable', system-ui, sans-serif"
      >
        {Math.round(max)}m · {Math.round(min)}m
      </text>

      {/* Fly-along scrubber */}
      {scrubX !== null && (
        <>
          <line
            x1={scrubX} x2={scrubX} y1={PAD_TOP} y2={h}
            stroke={stroke}
            strokeWidth={flyAlongPaused ? 2 : 1.5}
            strokeOpacity={flyAlongPaused ? 1 : 0.75}
          />
          <circle
            cx={scrubX} cy={yAtT(flyAlongProgress!)}
            r={4.5} fill={stroke} stroke="white" strokeWidth={1.5}
          />
        </>
      )}

      {/* Hover indicator — only while interactive and not coinciding with scrubber */}
      {hoverX !== null && hoverX !== scrubX && (
        <>
          <line
            x1={hoverX} x2={hoverX} y1={PAD_TOP} y2={h}
            stroke="rgba(255,255,255,0.45)" strokeWidth={1} strokeDasharray="3 3"
          />
          <circle
            cx={hoverX} cy={yAtT(hoverT!)}
            r={3} fill="rgba(255,255,255,0.85)"
          />
        </>
      )}
    </svg>
  )
}
