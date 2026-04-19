import { useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { toggleSection, setShowControls } from '../chrome/uiSlice'
import { setSelectedTheme, setFillOpacity, setSelectedUiTheme } from './mapStyleSlice'
import { setSelectedFeature } from '../map-core/mapInteractionSlice'
import { fitBounds } from '../map-core/commandedCameraSlice'
import { setCategoryAndResetDesignation, setDesignation } from './mapFilterSlice'
import { setTerrainExaggeration } from './terrainSlice'
import { THEME_OPTIONS } from '../../shared/constants/themes'
import { CATEGORY_OPTIONS, DESIGNATION_OPTIONS } from '../../shared/constants/filters'
import { UI_THEMES } from '../../shared/constants/uiThemes'
import { getCountry } from '../../shared/constants/parkLabels'
import { useMapEngine } from '../map-core/MapEngineContext'
import { TitleGlobe } from '../../shared/components/TitleGlobe'
import type { ParkSearchResult } from '../../shared/types'

export function ControlPanel() {
  const dispatch = useAppDispatch()
  const engine = useMapEngine()

  const showControls      = useAppSelector(s => s.ui.showControls)
  const sectionsOpen      = useAppSelector(s => s.ui.sectionsOpen)
  const selectedTheme     = useAppSelector(s => s.mapStyle.selectedTheme)
  const fillOpacity       = useAppSelector(s => s.mapStyle.fillOpacity)
  const selectedCategory  = useAppSelector(s => s.mapFilter.selectedCategory)
  const selectedDesig     = useAppSelector(s => s.mapFilter.selectedDesignation)
  const terrainExag       = useAppSelector(s => s.terrain.terrainExaggeration)
  const selectedUiTheme   = useAppSelector(s => s.mapStyle.selectedUiTheme)

  const [collapsed, setCollapsed] = useState(false)
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<ParkSearchResult[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  function handleQueryChange(q: string) {
    setQuery(q)
    clearTimeout(debounceRef.current)
    if (q.length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(() => {
      setResults(engine.searchParks(q))
    }, 200)
  }

  function handleResultSelect(result: ParkSearchResult) {
    dispatch(setSelectedFeature(result.properties))
    if (result.bounds) {
      dispatch(fitBounds({ bounds: result.bounds, padding: 60, maxZoom: 10 }))
    }
    setQuery('')
    setResults([])
  }

  function clearSearch() {
    setQuery('')
    setResults([])
  }

  return (
    <div className={`control-panel ${showControls ? 'mobile-visible' : ''}`}>
      <button className="panel-close" onClick={() => dispatch(setShowControls(false))} aria-label="Close">×</button>

      <div className="panel-title" onClick={() => setCollapsed(c => !c)}>
        <TitleGlobe size={28} />
        <span className="panel-title-text">SilkyMaps</span>
        <span className={`panel-title-chevron${collapsed ? ' collapsed' : ''}`}>▾</span>
      </div>

      <div className={`panel-body${collapsed ? ' collapsed' : ''}`}>

      {/* Search */}
      <div className="search-group">
        <input
          type="text"
          className="search-input"
          placeholder="Search parks in view…"
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          autoComplete="off"
        />
        {query && (
          <button className="search-clear" onClick={clearSearch} aria-label="Clear search">×</button>
        )}
        {results.length > 0 && (
          <div className="search-results">
            {results.map((r, i) => {
              const country = getCountry(r.iso3)
              return (
                <button key={i} className="search-result-item" onClick={() => handleResultSelect(r)}>
                  <span className="search-result-name">{r.name}</span>
                  <span className="search-result-meta">{country.flag} {country.name} · {r.designation}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="section">
        <button
          className={`section-header ${sectionsOpen.filters ? 'open' : ''}`}
          onClick={() => dispatch(toggleSection('filters'))}
        >
          <span>Filters</span>
          <span className="section-icon">{sectionsOpen.filters ? '−' : '+'}</span>
        </button>
        {sectionsOpen.filters && (
          <div className="section-content">
            <div className="filter-group">
              <span className="filter-label">Category</span>
              <div className="chip-group">
                {CATEGORY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`chip ${selectedCategory === opt.value ? 'active' : ''}`}
                    onClick={() => dispatch(setCategoryAndResetDesignation(opt.value))}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-group">
              <span className="filter-label">Designation</span>
              <select
                value={selectedDesig}
                onChange={(e) => dispatch(setDesignation(e.target.value))}
              >
                {DESIGNATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="section">
        <button
          className={`section-header ${sectionsOpen.style ? 'open' : ''}`}
          onClick={() => dispatch(toggleSection('style'))}
        >
          <span>Style</span>
          <span className="section-icon">{sectionsOpen.style ? '−' : '+'}</span>
        </button>
        {sectionsOpen.style && (
          <div className="section-content">
            <div className="filter-group">
              <span className="filter-label">Color by</span>
              <div className="segmented-control">
                {THEME_OPTIONS.map((opt, i) => (
                  <button
                    key={opt.property}
                    className={`segment ${selectedTheme === i ? 'active' : ''}`}
                    onClick={() => dispatch(setSelectedTheme(i))}
                    title={opt.label}
                  >
                    {opt.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-group">
              <div className="slider-header">
                <span className="filter-label">Opacity</span>
                <span className="slider-value">{Math.round(fillOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={fillOpacity * 100}
                onChange={(e) => dispatch(setFillOpacity(Number(e.target.value) / 100))}
              />
            </div>
          </div>
        )}
      </div>

      <div className="section">
        <button
          className={`section-header ${sectionsOpen.display ? 'open' : ''}`}
          onClick={() => dispatch(toggleSection('display'))}
        >
          <span>Display</span>
          <span className="section-icon">{sectionsOpen.display ? '−' : '+'}</span>
        </button>
        {sectionsOpen.display && (
          <div className="section-content">
            <div className="filter-group">
              <div className="slider-header">
                <span className="filter-label">Terrain</span>
                <span className="slider-value">{terrainExag.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="0.5"
                value={terrainExag * 10}
                onChange={(e) => dispatch(setTerrainExaggeration(Number(e.target.value) / 10))}
              />
            </div>
          </div>
        )}
      </div>

      <div className="section">
        <button
          className={`section-header ${sectionsOpen.appearance ? 'open' : ''}`}
          onClick={() => dispatch(toggleSection('appearance'))}
        >
          <span>Appearance</span>
          <span className="section-icon">{sectionsOpen.appearance ? '−' : '+'}</span>
        </button>
        {sectionsOpen.appearance && (
          <div className="section-content">
            <div className="filter-group">
              <span className="filter-label">UI Theme</span>
              <div className="theme-grid">
                {UI_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    className={`theme-swatch-btn ${selectedUiTheme === theme.id ? 'active' : ''}`}
                    onClick={() => dispatch(setSelectedUiTheme(theme.id))}
                    title={theme.label}
                  >
                    <div className="theme-swatch-preview" style={{ background: theme.previewGradient }}>
                      <div className="theme-swatch-dot" style={{ background: theme.previewDot }} />
                    </div>
                    <span className="theme-swatch-label">{theme.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      </div>
    </div>
  )
}
