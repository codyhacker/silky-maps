import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { TitleGlobe } from './TitleGlobe'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'YOUR_MAPBOX_ACCESS_TOKEN'

interface ThemeOption {
  label: string
  property: string
  colors: Record<string, string>
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    label: 'Designation Type',
    property: 'DESIG_TYPE',
    colors: {
      National: '#22c55e',
      International: '#3b82f6'
    }
  },
  {
    label: 'IUCN Category',
    property: 'IUCN_CAT',
    colors: {
      Ia: '#064e3b',
      Ib: '#065f46',
      II: '#047857',
      III: '#059669',
      IV: '#10b981',
      V: '#34d399',
      VI: '#6ee7b7',
      'Not Reported': '#6b7280',
      'Not Applicable': '#9ca3af',
      'Not Assigned': '#d1d5db'
    }
  },
  {
    label: 'Status',
    property: 'STATUS',
    colors: {
      Designated: '#22c55e',
      Established: '#14b8a6',
      Inscribed: '#3b82f6'
    }
  },
  {
    label: 'Governance',
    property: 'GOV_TYPE',
    colors: {
      'Federal or national ministry or agency': '#3b82f6',
      'Sub-national ministry or agency': '#6366f1',
      'Collaborative governance': '#a855f7',
      'Joint governance': '#d946ef',
      'Individual landowners': '#ec4899',
      'Non-profit organisations': '#f43f5e',
      'Not Reported': '#6b7280'
    }
  }
]

const DEFAULT_COLOR = '#22c55e'

// Vector tile server configuration
const TILE_SERVER_URL = import.meta.env.VITE_TILE_SERVER_URL || 'http://localhost:8080'
const SOURCE_LAYER = 'geo' // Must match your vector tile layer name

// Custom dark purple style
const PURPLE_STYLE: mapboxgl.StyleSpecification = {
  version: 8,
  name: 'Dark Purple',
  sources: {
    'mapbox-streets': {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-streets-v8'
    }
  },
  sprite: 'mapbox://sprites/mapbox/dark-v11',
  glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#1a1025'
      }
    },
    {
      id: 'water',
      type: 'fill',
      source: 'mapbox-streets',
      'source-layer': 'water',
      paint: {
        'fill-color': '#2d1f42'
      }
    },
    {
      id: 'landcover',
      type: 'fill',
      source: 'mapbox-streets',
      'source-layer': 'landcover',
      paint: {
        'fill-color': '#241735',
        'fill-opacity': 0.5
      }
    },
    {
      id: 'landuse',
      type: 'fill',
      source: 'mapbox-streets',
      'source-layer': 'landuse',
      paint: {
        'fill-color': [
          'match',
          ['get', 'class'],
          ['park', 'grass', 'cemetery'],
          '#2a1d3d',
          ['hospital', 'school'],
          '#2f2045',
          '#241735'
        ],
        'fill-opacity': 0.6
      }
    },
    {
      id: 'hillshade',
      type: 'hillshade',
      source: 'mapbox-streets',
      'source-layer': 'hillshade',
      paint: {
        'hillshade-shadow-color': '#1a1025',
        'hillshade-highlight-color': '#4a3660',
        'hillshade-accent-color': '#3d2952'
      }
    },
    {
      id: 'contour',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'contour',
      paint: {
        'line-color': '#3d2952',
        'line-opacity': 0.3,
        'line-width': 0.5
      }
    },
    {
      id: 'building',
      type: 'fill',
      source: 'mapbox-streets',
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-color': '#3d2952',
        'fill-opacity': 0.8
      }
    },
    {
      id: 'road-minor',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      minzoom: 14,
      filter: ['in', 'class', 'street', 'street_limited', 'service', 'track'],
      paint: {
        'line-color': '#2d1f42',
        'line-width': 0.5,
        'line-opacity': 0.4
      }
    },
    {
      id: 'road-major',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      minzoom: 10,
      filter: ['in', 'class', 'primary', 'secondary', 'tertiary'],
      paint: {
        'line-color': '#3d2952',
        'line-width': 1,
        'line-opacity': 0.5
      }
    },
    {
      id: 'road-highway',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      minzoom: 6,
      filter: ['==', 'class', 'motorway'],
      paint: {
        'line-color': '#4a3660',
        'line-width': 1.5,
        'line-opacity': 0.6
      }
    },
    {
      id: 'admin-boundaries',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'admin',
      filter: ['>=', 'admin_level', 2],
      paint: {
        'line-color': '#6b4d8a',
        'line-width': 1,
        'line-dasharray': [2, 2]
      }
    },
    {
      id: 'place-labels',
      type: 'symbol',
      source: 'mapbox-streets',
      'source-layer': 'place_label',
      filter: ['in', 'class', 'city', 'town'],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 10, 16]
      },
      paint: {
        'text-color': '#c4a3e0',
        'text-halo-color': '#1a1025',
        'text-halo-width': 1.5
      }
    },
    {
      id: 'country-labels',
      type: 'symbol',
      source: 'mapbox-streets',
      'source-layer': 'place_label',
      filter: ['==', 'class', 'country'],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 6, 18]
      },
      paint: {
        'text-color': '#d4b8e8',
        'text-halo-color': '#1a1025',
        'text-halo-width': 2
      }
    }
  ]
}

interface BasemapOption {
  id: string
  label: string
  style: string | mapboxgl.StyleSpecification
}

const BASEMAP_OPTIONS: BasemapOption[] = [
  { id: 'purple', label: 'Dark Purple', style: PURPLE_STYLE },
  { id: 'satellite', label: 'Satellite', style: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { id: 'dark', label: 'Dark', style: 'mapbox://styles/mapbox/dark-v11' },
  { id: 'light', label: 'Light', style: 'mapbox://styles/mapbox/light-v11' },
  { id: 'outdoors', label: 'Outdoors', style: 'mapbox://styles/mapbox/outdoors-v12' }
]

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'National', label: 'National' },
  { value: 'International', label: 'International' }
]

const DESIGNATION_OPTIONS = [
  { value: 'all', label: 'All Designations' },
  { value: 'National Park', label: 'National Park' },
  { value: 'Marine Protected Area', label: 'Marine Protected Area' },
  { value: 'Conservation Area', label: 'Conservation Area' },
  { value: 'Conservation Easement', label: 'Conservation Easement' },
  { value: 'Conservation Park', label: 'Conservation Park' },
  { value: 'Conservation Preserve', label: 'Conservation Preserve' },
  { value: 'Conservation Reserve', label: 'Conservation Reserve' },
  { value: 'Ecological Reserve', label: 'Ecological Reserve' },
  { value: 'Forest Preserve', label: 'Forest Preserve' },
  { value: 'Forest Reserve', label: 'Forest Reserve' },
  { value: 'Bird Sanctuary', label: 'Bird Sanctuary' },
  { value: 'Game Preserve', label: 'Game Preserve' },
  { value: 'Arboretum', label: 'Arboretum' },
  { value: 'Botanical Reserve', label: 'Botanical Reserve' }
]

// Helper function to lighten a hex color
function lightenColor(hex: string, amount: number = 0.3): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.round(((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * amount))
  const g = Math.min(255, Math.round(((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * amount))
  const b = Math.min(255, Math.round((num & 0xff) + (255 - (num & 0xff)) * amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function buildColorExpression(theme: ThemeOption): mapboxgl.Expression {
  const entries: (string | string[])[] = ['match', ['get', theme.property]]
  for (const [value, color] of Object.entries(theme.colors)) {
    entries.push(value, color)
  }
  entries.push(DEFAULT_COLOR)
  return entries as mapboxgl.Expression
}

function buildOutlineColorExpression(theme: ThemeOption): mapboxgl.Expression {
  const entries: (string | string[])[] = ['match', ['get', theme.property]]
  for (const [value, color] of Object.entries(theme.colors)) {
    entries.push(value, lightenColor(color, 0.4))
  }
  entries.push(lightenColor(DEFAULT_COLOR, 0.4))
  return entries as mapboxgl.Expression
}

function App() {
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const popup = useRef<mapboxgl.Popup | null>(null)
  const hoveredId = useRef<string | number | null>(null)

  const [selectedTheme, setSelectedTheme] = useState<number>(1)
  const [fillOpacity, setFillOpacity] = useState<number>(0.5)
  const [terrainExaggeration, setTerrainExaggeration] = useState<number>(1.5)
  const [selectedCategory, setSelectedCategory] = useState<string>('National')
  const [selectedDesignation, setSelectedDesignation] = useState<string>('National Park')

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category)
    // Reset designation when category changes to avoid empty results
    setSelectedDesignation('all')
  }
  const [selectedBasemap, setSelectedBasemap] = useState<string>('purple')
  const [hoveredFeature, setHoveredFeature] = useState<Record<string, unknown> | null>(null)

  // Basemap dropdown visibility
  const [showBasemapMenu, setShowBasemapMenu] = useState(false)

  // Collapsible section state
  const [sectionsOpen, setSectionsOpen] = useState({
    filters: true,
    style: true,
    display: false
  })

  // Mobile panel visibility
  const [showControls, setShowControls] = useState(false)
  const [showLegend, setShowLegend] = useState(false)

  const toggleSection = (section: keyof typeof sectionsOpen) => {
    setSectionsOpen(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const closeMobilePanels = () => {
    setShowControls(false)
    setShowLegend(false)
  }

  const addDataLayers = useCallback((m: mapboxgl.Map) => {
    // Add terrain source if not present
    if (!m.getSource('mapbox-dem')) {
      m.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14
      })
    }

    // Enable 3D terrain
    m.setTerrain({ source: 'mapbox-dem', exaggeration: terrainExaggeration })

    // Add sky layer for atmosphere
    if (!m.getLayer('sky')) {
      m.addLayer({
        id: 'sky',
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0.0, 90.0],
          'sky-atmosphere-sun-intensity': 15
        }
      })
    }

    // Add PMTiles source if not present
    if (!m.getSource('national-parks')) {
      m.addSource('national-parks', {
        type: 'vector',
        tiles: [`${TILE_SERVER_URL}/data/pmtiles/{z}/{x}/{y}.pbf`],
        promoteId: 'SITE_PID'
      })
    }

    const theme = THEME_OPTIONS[selectedTheme]

    // Build current filter
    const conditions: mapboxgl.FilterSpecification[] = []
    if (selectedCategory !== 'all') {
      conditions.push(['==', ['get', 'DESIG_TYPE'], selectedCategory])
    }
    if (selectedDesignation !== 'all') {
      conditions.push(['==', ['get', 'DESIG'], selectedDesignation])
    }
    let filter: mapboxgl.FilterSpecification | null = null
    if (conditions.length === 1) {
      filter = conditions[0]
    } else if (conditions.length > 1) {
      filter = ['all', ...conditions] as mapboxgl.FilterSpecification
    }

    // Add fill layer
    if (!m.getLayer('parks-fill')) {
      m.addLayer({
        id: 'parks-fill',
        type: 'fill',
        source: 'national-parks',
        'source-layer': SOURCE_LAYER,
        filter: filter ?? undefined,
        paint: {
          'fill-color': buildColorExpression(theme),
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            Math.min(fillOpacity + 0.3, 1),
            fillOpacity
          ]
        }
      })
    }

    // Add outline layer
    if (!m.getLayer('parks-outline')) {
      m.addLayer({
        id: 'parks-outline',
        type: 'line',
        source: 'national-parks',
        'source-layer': SOURCE_LAYER,
        filter: filter ?? undefined,
        paint: {
          'line-color': buildOutlineColorExpression(theme),
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            2,
            0.8
          ],
          'line-opacity': 0.9
        }
      })
    }
  }, [selectedTheme, fillOpacity, terrainExaggeration, selectedCategory, selectedDesignation])

  const handleBasemapChange = useCallback((basemapId: string) => {
    const m = map.current
    if (!m) return

    const basemap = BASEMAP_OPTIONS.find(b => b.id === basemapId)
    if (!basemap) return

    setSelectedBasemap(basemapId)

    m.setStyle(basemap.style)

    m.once('style.load', () => {
      addDataLayers(m)
    })
  }, [addDataLayers])

  const updateStyle = useCallback(() => {
    const m = map.current
    if (!m || !m.getLayer('parks-fill')) return

    const theme = THEME_OPTIONS[selectedTheme]
    m.setPaintProperty('parks-fill', 'fill-color', buildColorExpression(theme))
    m.setPaintProperty('parks-fill', 'fill-opacity', [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      Math.min(fillOpacity + 0.3, 1),
      fillOpacity
    ])

    // Update outline color to match fill but brighter
    if (m.getLayer('parks-outline')) {
      m.setPaintProperty('parks-outline', 'line-color', buildOutlineColorExpression(theme))
    }
  }, [selectedTheme, fillOpacity])

  const updateTerrain = useCallback(() => {
    const m = map.current
    if (!m || !m.getSource('mapbox-dem')) return

    if (terrainExaggeration > 0) {
      m.setTerrain({ source: 'mapbox-dem', exaggeration: terrainExaggeration })
    } else {
      m.setTerrain(null)
    }
  }, [terrainExaggeration])

  const updateFilter = useCallback(() => {
    const m = map.current
    if (!m || !m.getLayer('parks-fill')) return

    const conditions: mapboxgl.FilterSpecification[] = []

    if (selectedCategory !== 'all') {
      conditions.push(['==', ['get', 'DESIG_TYPE'], selectedCategory])
    }

    if (selectedDesignation !== 'all') {
      conditions.push(['==', ['get', 'DESIG'], selectedDesignation])
    }

    let filter: mapboxgl.FilterSpecification | null = null
    if (conditions.length === 1) {
      filter = conditions[0]
    } else if (conditions.length > 1) {
      filter = ['all', ...conditions] as mapboxgl.FilterSpecification
    }

    m.setFilter('parks-fill', filter)
    m.setFilter('parks-outline', filter)
  }, [selectedCategory, selectedDesignation])

  useEffect(() => {
    updateStyle()
  }, [updateStyle])

  useEffect(() => {
    updateTerrain()
  }, [updateTerrain])

  useEffect(() => {
    updateFilter()
  }, [updateFilter])

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    const initialBasemap = BASEMAP_OPTIONS.find(b => b.id === 'purple') || BASEMAP_OPTIONS[0]

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: initialBasemap.style,
      center: [-98.5, 39.5],
      zoom: 3.5,
      pitch: 30,
      bearing: 0,
      attributionControl: false
    })

    popup.current = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: '320px'
    })

    const m = map.current

    m.addControl(new mapboxgl.NavigationControl(), 'top-right')
    m.addControl(new mapboxgl.FullscreenControl(), 'top-right')

    m.on('load', () => {
      addDataLayers(m)
    })

    // Hover events
    m.on('mousemove', 'parks-fill', (e) => {
      m.getCanvas().style.cursor = 'pointer'

      if (e.features && e.features.length > 0) {
        const feature = e.features[0]
        const id = feature.id

        if (hoveredId.current !== null && hoveredId.current !== id) {
          m.setFeatureState(
            { source: 'national-parks', sourceLayer: SOURCE_LAYER, id: hoveredId.current },
            { hover: false }
          )
        }

        if (id !== undefined) {
          hoveredId.current = id
          m.setFeatureState(
            { source: 'national-parks', sourceLayer: SOURCE_LAYER, id },
            { hover: true }
          )
        }

        setHoveredFeature(feature.properties as Record<string, unknown>)
      }
    })

    m.on('mouseleave', 'parks-fill', () => {
      m.getCanvas().style.cursor = ''

      if (hoveredId.current !== null) {
        m.setFeatureState(
          { source: 'national-parks', sourceLayer: SOURCE_LAYER, id: hoveredId.current },
          { hover: false }
        )
        hoveredId.current = null
      }

      setHoveredFeature(null)
    })

    // Click event
    m.on('click', 'parks-fill', (e) => {
      if (!e.features || e.features.length === 0) return

      const feature = e.features[0]
      console.log(feature);
      const props = feature.properties as Record<string, unknown>
      const coords = e.lngLat

      const html = `
        <div class="popup-content">
          <h3 class="popup-title">${props.NAME || props.NAME_ENG || 'Unknown'}</h3>
          <div class="popup-badges">
            <span class="popup-badge">${props.DESIG_TYPE || 'N/A'}</span>
            <span class="popup-badge">${props.IUCN_CAT || 'N/A'}</span>
          </div>
          <div class="popup-grid">
            <div class="popup-row">
              <span class="popup-label">Designation</span>
              <span class="popup-value">${props.DESIG || 'N/A'}</span>
            </div>
            <div class="popup-row">
              <span class="popup-label">Status</span>
              <span class="popup-value">${props.STATUS || 'N/A'} ${props.STATUS_YR ? '(' + props.STATUS_YR + ')' : ''}</span>
            </div>
            <div class="popup-row">
              <span class="popup-label">Governance</span>
              <span class="popup-value">${props.GOV_TYPE || 'N/A'}</span>
            </div>
            <div class="popup-row">
              <span class="popup-label">Area</span>
              <span class="popup-value">${props.REP_AREA ? Number(props.REP_AREA).toLocaleString() + ' km²' : 'N/A'}</span>
            </div>
            <div class="popup-row">
              <span class="popup-label">Country</span>
              <span class="popup-value">${props.ISO3 || 'N/A'}</span>
            </div>
          </div>
        </div>
      `

      popup.current?.setLngLat(coords).setHTML(html).addTo(m)
    })

    return () => {
      popup.current?.remove()
      m.remove()
      map.current = null
    }
  }, [])

  const theme = THEME_OPTIONS[selectedTheme]

  return (
    <div className="map-container">
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Mobile Toggle Buttons */}
      <div className="mobile-toggles">
        <button
          className={`mobile-toggle ${showLegend ? 'active' : ''}`}
          onClick={() => { setShowLegend(!showLegend); setShowControls(false) }}
          aria-label="Toggle legend"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </button>
        <button
          className={`mobile-toggle ${showControls ? 'active' : ''}`}
          onClick={() => { setShowControls(!showControls); setShowLegend(false) }}
          aria-label="Toggle controls"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
          </svg>
        </button>
      </div>

      {/* Mobile Overlay */}
      {(showControls || showLegend) && (
        <div className="mobile-overlay" onClick={closeMobilePanels} />
      )}

      {/* Legend Panel - Top Left */}
      <div className={`legend-panel ${showLegend ? 'mobile-visible' : ''}`}>
        <button className="panel-close" onClick={() => setShowLegend(false)} aria-label="Close">×</button>
        <h3>Legend</h3>
        <p className="legend-subtitle">{theme.label}</p>
        {Object.entries(theme.colors).map(([label, color]) => (
          <div key={label} className="legend-item">
            <span className="legend-swatch" style={{ backgroundColor: color }} />
            <span className="legend-label">{label}</span>
          </div>
        ))}

        {hoveredFeature && (
          <div className="hover-info">
            <h4>Hovered</h4>
            <p className="hover-name">{String(hoveredFeature.NAME || hoveredFeature.NAME_ENG || 'Unknown')}</p>
            <p className="hover-detail">{String(hoveredFeature.DESIG_TYPE || '')} · {String(hoveredFeature.IUCN_CAT || '')}</p>
          </div>
        )}
      </div>

      {/* Basemap Control - Floating */}
      <div className="basemap-control">
        <button
          className={`basemap-toggle ${showBasemapMenu ? 'active' : ''}`}
          onClick={() => setShowBasemapMenu(!showBasemapMenu)}
          aria-label="Change basemap"
          title="Change basemap"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
        </button>
        {showBasemapMenu && (
          <div className="basemap-menu">
            {BASEMAP_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                className={`basemap-menu-item ${selectedBasemap === opt.id ? 'active' : ''}`}
                onClick={() => {
                  handleBasemapChange(opt.id)
                  setShowBasemapMenu(false)
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Control Panel - Top Left */}
      <div className={`control-panel ${showControls ? 'mobile-visible' : ''}`}>
        <button className="panel-close" onClick={() => setShowControls(false)} aria-label="Close">×</button>
        
        {/* Title Header */}
        <div className="panel-title">
          <TitleGlobe size={28} />
          <span className="panel-title-text">SilkyMaps</span>
        </div>

        {/* Filters Section */}
        <div className="section">
          <button
            className={`section-header ${sectionsOpen.filters ? 'open' : ''}`}
            onClick={() => toggleSection('filters')}
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
                      onClick={() => handleCategoryChange(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="filter-group">
                <span className="filter-label">Designation</span>
                <select
                  value={selectedDesignation}
                  onChange={(e) => setSelectedDesignation(e.target.value)}
                >
                  {DESIGNATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Style Section */}
        <div className="section">
          <button
            className={`section-header ${sectionsOpen.style ? 'open' : ''}`}
            onClick={() => toggleSection('style')}
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
                      onClick={() => setSelectedTheme(i)}
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
                  onChange={(e) => setFillOpacity(Number(e.target.value) / 100)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Display Section */}
        <div className="section">
          <button
            className={`section-header ${sectionsOpen.display ? 'open' : ''}`}
            onClick={() => toggleSection('display')}
          >
            <span>Display</span>
            <span className="section-icon">{sectionsOpen.display ? '−' : '+'}</span>
          </button>
          {sectionsOpen.display && (
            <div className="section-content">
              <div className="filter-group">
                <div className="slider-header">
                  <span className="filter-label">Terrain</span>
                  <span className="slider-value">{terrainExaggeration.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="0.5"
                  value={terrainExaggeration * 10}
                  onChange={(e) => setTerrainExaggeration(Number(e.target.value) / 10)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
