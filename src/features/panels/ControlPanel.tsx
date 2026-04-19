import { clsx } from 'clsx'
import { useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { toggleSection, setShowControls } from '../shell/uiSlice'
import { setSelectedTheme, setFillOpacity, setSelectedUiTheme, setSelectedBasemap } from '../map/styleSlice'
import { setTerrainExaggeration } from '../map/terrainSlice'
import { fitBounds } from '../map/cameraSlice'
import { useMapEngine } from '../map/engine/MapEngineContext'
import { setSelectedFeature } from '../parks/interactionSlice'
import { setCategoryAndResetDesignation, setDesignation } from '../parks/filterSlice'
import { THEME_LABELS } from '../../shared/constants/dataPalettes'
import { CATEGORY_OPTIONS, DESIGNATION_OPTIONS } from '../../shared/constants/filters'
import { UI_THEMES } from '../../shared/constants/uiThemes'
import { BASEMAP_OPTIONS } from '../../shared/constants/basemaps'
import { getCountry } from '../../shared/constants/parkLabels'
import { TitleGlobe } from '../../shared/components/TitleGlobe'
import type { ParkSearchResult } from '../../shared/types'

/* ── Shared sub-component styles ─────────────────────────────────────────── */
const sectionHeaderBase = clsx(
  'w-full flex justify-between items-center px-3 py-2.5 max-md:py-3.5 max-md:px-4',
  'bg-accent/10 border-0 rounded-lg',
  'text-[var(--text-light)] text-[12px] max-md:text-[13px] font-semibold uppercase tracking-[0.5px]',
  'cursor-pointer transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
  'hover:bg-accent/20 hover:translate-x-0.5 active:scale-[0.98]'
)

const chipBase = clsx(
  'px-2.5 py-1.5 max-md:py-2.5 max-md:px-3.5',
  'bg-surface-3/40 border border-accent/20 rounded-2xl',
  'text-[var(--text-med)] text-[11px] max-md:text-xs',
  'cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
  'hover:bg-accent/25 hover:border-accent/40 hover:-translate-y-px active:scale-[0.95]'
)

export function ControlPanel() {
  const dispatch = useAppDispatch()
  const engine   = useMapEngine()

  const showControls     = useAppSelector(s => s.ui.showControls)
  const sectionsOpen     = useAppSelector(s => s.ui.sectionsOpen)
  const selectedTheme    = useAppSelector(s => s.mapStyle.selectedTheme)
  const fillOpacity      = useAppSelector(s => s.mapStyle.fillOpacity)
  const selectedCategory = useAppSelector(s => s.parksFilter.selectedCategory)
  const selectedDesig    = useAppSelector(s => s.parksFilter.selectedDesignation)
  const terrainExag      = useAppSelector(s => s.terrain.terrainExaggeration)
  const selectedUiTheme  = useAppSelector(s => s.mapStyle.selectedUiTheme)
  const selectedBasemap  = useAppSelector(s => s.mapStyle.selectedBasemap)

  const [collapsed, setCollapsed] = useState(false)
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<ParkSearchResult[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  function handleQueryChange(q: string) {
    setQuery(q)
    clearTimeout(debounceRef.current)
    if (q.length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(() => setResults(engine.searchParks(q)), 200)
  }

  function handleResultSelect(result: ParkSearchResult) {
    dispatch(setSelectedFeature(result.properties))
    if (result.bounds) dispatch(fitBounds({ bounds: result.bounds, padding: 60, maxZoom: 10 }))
    setQuery(''); setResults([])
  }

  function clearSearch() { setQuery(''); setResults([]) }

  function handleTitleClick() {
    if (window.innerWidth <= 768) dispatch(setShowControls(false))
    else setCollapsed(c => !c)
  }

  return (
    <div className={`control-panel ${showControls ? 'mobile-visible' : ''}`}>

      {/* ── Title bar ──────────────────────────────────────────────────────── */}
      <div
        className={clsx(
          'flex items-center justify-center max-md:justify-start',
          'gap-2.5 max-md:gap-3',
          'px-4 py-3 mb-1.5',
          'rounded-[10px] max-md:rounded-lg',
          'border border-accent/20',
          'sticky top-0 z-[2] cursor-pointer select-none',
          'backdrop-blur-[8px] bg-title-bar'
        )}
        onClick={handleTitleClick}
      >
        <TitleGlobe size={28} />
        <span className="text-[20px] font-bold text-gradient-title">SilkyMaps</span>
        <span className={clsx(
          'ml-auto text-xs text-[var(--text-secondary)] leading-none transition-transform duration-[250ms]',
          'max-md:hidden',
          collapsed && '-rotate-90'
        )}>▾</span>
      </div>

      {/* ── Collapsible body ───────────────────────────────────────────────── */}
      <div className={`panel-body${collapsed ? ' collapsed' : ''}`}>

        {/* Search */}
        <div className="relative px-2 pt-1 pb-2">
          <input
            type="text"
            className={clsx(
              'w-full py-2 pl-2.5 pr-8',
              'bg-surface-3/50 border border-accent/25 rounded-lg',
              'text-[var(--text-primary)] text-xs font-[system-ui,-apple-system,sans-serif]',
              'outline-none transition-[border-color] duration-200',
              'placeholder:text-[var(--text-muted)]',
              'focus:border-accent/50'
            )}
            placeholder="Search parks in view…"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            autoComplete="off"
          />
          {query && (
            <button
              className="absolute right-[18px] top-1/2 -translate-y-[60%] bg-transparent border-0 text-[var(--text-muted)] cursor-pointer text-base leading-none px-0.5 hover:text-[var(--text-secondary)]"
              onClick={clearSearch}
              aria-label="Clear search"
            >×</button>
          )}
          {results.length > 0 && (
            <div className={clsx(
              'absolute left-2 right-2 top-[calc(100%-4px)]',
              'bg-panel-dark backdrop-blur-[12px]',
              'border border-accent/30 rounded-[10px] overflow-hidden z-50',
              'shadow-[0_8px_24px_rgba(0,0,0,0.4)]',
              'animate-[menuSlideIn_0.15s_cubic-bezier(0.16,1,0.3,1)]'
            )}>
              {results.map((r, i) => {
                const country = getCountry(r.iso3)
                return (
                  <button
                    key={i}
                    className={clsx(
                      'w-full px-3.5 py-2.5 bg-transparent border-0 text-left cursor-pointer',
                      'flex flex-col gap-0.5 transition-[background] duration-150',
                      'border-b border-accent/10 last:border-b-0',
                      'hover:bg-accent/15'
                    )}
                    onClick={() => handleResultSelect(r)}
                  >
                    <span className="text-xs font-medium text-[var(--text-primary)]">{r.name}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{country.flag} {country.name} · {r.designation}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Filters section ──────────────────────────────────────────────── */}
        <div className="mb-1 last:mb-0">
          <button
            className={clsx(sectionHeaderBase, sectionsOpen.filters && 'bg-accent/25 !rounded-b-none')}
            onClick={() => dispatch(toggleSection('filters'))}
          >
            <span>Filters</span>
            <span className="text-sm font-normal opacity-70">{sectionsOpen.filters ? '−' : '+'}</span>
          </button>
          {sectionsOpen.filters && (
            <div className="p-3 bg-black/15 rounded-b-lg border-t border-accent/15 animate-[expandDown_0.3s_cubic-bezier(0.16,1,0.3,1)] origin-top">
              <div className="mb-3.5 last:mb-0">
                <span className="block text-[11px] text-[var(--text-muted)] mb-2 uppercase tracking-[0.3px]">Category</span>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      className={clsx(chipBase, selectedCategory === opt.value && 'bg-active-gradient border-[var(--active-border)] text-white animate-[chipActivate_0.25s_cubic-bezier(0.16,1,0.3,1)]')}
                      onClick={() => dispatch(setCategoryAndResetDesignation(opt.value))}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-0">
                <span className="block text-[11px] text-[var(--text-muted)] mb-2 uppercase tracking-[0.3px]">Designation</span>
                <select
                  className="panel-select"
                  value={selectedDesig}
                  onChange={e => dispatch(setDesignation(e.target.value))}
                >
                  {DESIGNATION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* ── Style section ─────────────────────────────────────────────────── */}
        <div className="mb-1 last:mb-0">
          <button
            className={clsx(sectionHeaderBase, sectionsOpen.style && 'bg-accent/25 !rounded-b-none')}
            onClick={() => dispatch(toggleSection('style'))}
          >
            <span>Style</span>
            <span className="text-sm font-normal opacity-70">{sectionsOpen.style ? '−' : '+'}</span>
          </button>
          {sectionsOpen.style && (
            <div className="p-3 bg-black/15 rounded-b-lg border-t border-accent/15 animate-[expandDown_0.3s_cubic-bezier(0.16,1,0.3,1)] origin-top">
              <div className="mb-3.5 last:mb-0">
                <span className="block text-[11px] text-[var(--text-muted)] mb-2 uppercase tracking-[0.3px]">Basemap</span>
                <div className="flex flex-wrap gap-1.5">
                  {BASEMAP_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      className={clsx(chipBase, selectedBasemap === opt.id && 'bg-active-gradient border-[var(--active-border)] text-white animate-[chipActivate_0.25s_cubic-bezier(0.16,1,0.3,1)]')}
                      onClick={() => dispatch(setSelectedBasemap(opt.id))}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-3.5 last:mb-0">
                <span className="block text-[11px] text-[var(--text-muted)] mb-2 uppercase tracking-[0.3px]">Color by</span>
                <div className="flex bg-black/20 rounded-md p-[3px] gap-0.5">
                  {THEME_LABELS.map((opt, i) => (
                    <button
                      key={opt.property}
                      className={clsx(
                        'flex-1 py-1.5 px-1 max-md:py-2.5 max-md:px-1.5',
                        'bg-transparent border-0 rounded text-[10px] max-md:text-[11px] cursor-pointer',
                        'transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
                        'whitespace-nowrap overflow-hidden text-ellipsis active:scale-[0.95]',
                        selectedTheme === i
                          ? 'bg-active-gradient text-white shadow-[0_2px_8px_rgba(var(--active-rgb),0.4)] animate-[segmentActivate_0.3s_cubic-bezier(0.16,1,0.3,1)]'
                          : 'text-[var(--text-muted)] hover:bg-accent/20 hover:text-[var(--text-secondary)]'
                      )}
                      onClick={() => dispatch(setSelectedTheme(i))}
                      title={opt.label}
                    >
                      {opt.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-3.5 last:mb-0">
                <div className="flex justify-between items-center mb-2">
                  <span className="block text-[11px] text-[var(--text-muted)] uppercase tracking-[0.3px]">Opacity</span>
                  <span className="text-[11px] text-[var(--text-secondary)] font-medium">{Math.round(fillOpacity * 100)}%</span>
                </div>
                <input
                  type="range" min="0" max="100"
                  value={fillOpacity * 100}
                  onChange={e => dispatch(setFillOpacity(Number(e.target.value) / 100))}
                />
              </div>
              <div className="mb-0">
                <span className="block text-[11px] text-[var(--text-muted)] mb-2 uppercase tracking-[0.3px]">UI Theme</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {UI_THEMES.map(theme => (
                    <button
                      key={theme.id}
                      className={clsx(
                        'flex flex-col items-center gap-[5px] py-2 px-1',
                        'bg-transparent border border-accent/20 rounded-lg cursor-pointer',
                        'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
                        'hover:border-accent/50 hover:bg-accent/10 hover:-translate-y-px',
                        selectedUiTheme === theme.id && 'border-[var(--active-border)] bg-accent/15 shadow-[0_0_0_2px_rgba(var(--active-rgb),0.3)]'
                      )}
                      onClick={() => dispatch(setSelectedUiTheme(theme.id))}
                      title={theme.label}
                    >
                      <div
                        className="w-9 h-[26px] max-md:w-[30px] max-md:h-[22px] rounded-[5px] relative overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.4)]"
                        style={{ background: theme.previewGradient }}
                      >
                        <div
                          className="absolute bottom-1 right-1 w-2 h-2 rounded-full border border-white/30"
                          style={{ background: theme.previewDot }}
                        />
                      </div>
                      <span className={clsx(
                        'text-[9px] text-center whitespace-nowrap overflow-hidden text-ellipsis w-full px-0.5',
                        selectedUiTheme === theme.id ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'
                      )}>{theme.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Display section ───────────────────────────────────────────────── */}
        <div className="mb-1 last:mb-0">
          <button
            className={clsx(sectionHeaderBase, sectionsOpen.display && 'bg-accent/25 !rounded-b-none')}
            onClick={() => dispatch(toggleSection('display'))}
          >
            <span>Display</span>
            <span className="text-sm font-normal opacity-70">{sectionsOpen.display ? '−' : '+'}</span>
          </button>
          {sectionsOpen.display && (
            <div className="p-3 bg-black/15 rounded-b-lg border-t border-accent/15 animate-[expandDown_0.3s_cubic-bezier(0.16,1,0.3,1)] origin-top">
              <div className="mb-0">
                <div className="flex justify-between items-center mb-2">
                  <span className="block text-[11px] text-[var(--text-muted)] uppercase tracking-[0.3px]">Terrain</span>
                  <span className="text-[11px] text-[var(--text-secondary)] font-medium">{terrainExag.toFixed(1)}x</span>
                </div>
                <input
                  type="range" min="0" max="30" step="0.5"
                  value={terrainExag * 10}
                  onChange={e => dispatch(setTerrainExaggeration(Number(e.target.value) / 10))}
                />
              </div>
            </div>
          )}
        </div>

      </div>{/* end panel-body */}
    </div>
  )
}
