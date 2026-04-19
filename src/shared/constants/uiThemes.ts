import type { Map as MapboxMap, StyleSpecification, FogSpecification } from 'mapbox-gl'
import type { ThemeDataPalette } from './dataPalettes'

export interface UiPalette {
  // Backgrounds — stored as "R, G, B" for rgba() usage in CSS
  bgDeepRgb: string
  bgRichRgb: string
  bgWarmRgb: string

  // Accent — for borders, icons, interactive chrome
  accentRgb: string
  accentHex: string

  // Active / selected states
  activeStart: string
  activeEnd: string
  activeBorder: string
  activeRgb: string     // "R, G, B" for glow shadows

  // Text hierarchy
  textPrimary: string
  textSecondary: string
  textLight: string
  textMuted: string
  textMed: string

  // Slider thumb
  sliderStart: string
  sliderEnd: string
  sliderGlowRgb: string

  // Title gradient
  titleStart: string
  titleMid: string
  titleEnd: string

  // Globe glow
  globeGlowRgb: string
  globeAccentRgb: string

  // Popup tip background (full CSS value)
  popupTipColor: string

  // <select> option background (solid hex, must be opaque)
  optionBg: string

  // Mapbox navigation control icon filter
  ctrlIconFilter: string

  // Custom map layer colors
  mapBg: string
  mapWater: string
  mapLandcover: string
  mapLanduse1: string   // park / grass
  mapLanduse2: string   // hospital / school
  mapHillshadeHighlight: string
  mapHillshadeAccent: string
  mapContour: string
  mapBuilding: string
  mapRoadMinor: string
  mapRoadMajor: string
  mapRoadHighway: string
  mapAdmin: string
  mapLabelCity: string
  mapLabelCountry: string
  mapLabelHalo: string

  // Globe atmosphere + space (Mapbox `setFog()` payload — keys match spec)
  mapFog: {
    color: string             // lower atmosphere / horizon haze
    'high-color': string      // upper atmosphere
    'space-color': string     // deep space beyond the atmosphere
    'horizon-blend': number   // 0–1, softness of the horizon line
    'star-intensity': number  // 0–1, brightness of stars in space
  }

  // Parks-layer color ramps. Each UI theme picks a hue family that contrasts
  // its own basemap (cool/warm complement) while staying coordinated with the
  // chrome accents.
  dataPalette: ThemeDataPalette
}

export interface UiTheme {
  id: string
  label: string
  previewGradient: string  // CSS gradient shown in swatch
  previewDot: string       // accent dot color
  palette: UiPalette
}

// ─── Theme Definitions ────────────────────────────────────────────────────────

const SAGE_FOREST: UiTheme = {
  id: 'sage-forest',
  label: 'Sage Forest',
  previewGradient: 'linear-gradient(135deg, #111b0e, #1a2a14)',
  previewDot: '#649b4b',
  palette: {
    bgDeepRgb: '17, 27, 14',
    bgRichRgb: '26, 42, 20',
    bgWarmRgb: '37, 60, 28',
    accentRgb: '100, 155, 75',
    accentHex: '#5a8a3a',
    activeStart: '#4a7a30',
    activeEnd: '#365c20',
    activeBorder: '#5a8a3a',
    activeRgb: '74, 122, 48',
    textPrimary: '#d4eab8',
    textSecondary: '#a8c87a',
    textLight: '#bcd898',
    textMuted: '#7a9858',
    textMed: '#98b872',
    sliderStart: '#82b84a',
    sliderEnd: '#4a7a28',
    sliderGlowRgb: '130, 184, 74',
    titleStart: '#c4e464',
    titleMid: '#8cc43a',
    titleEnd: '#5a8a1a',
    globeGlowRgb: '130, 190, 70',
    globeAccentRgb: '160, 210, 80',
    popupTipColor: 'rgba(26, 42, 20, 0.98)',
    optionBg: '#1a2a14',
    ctrlIconFilter: 'invert(0.75) sepia(1) saturate(1.5) hue-rotate(65deg)',
    mapBg: '#111b0e',
    mapWater: '#182535',
    mapLandcover: '#1a2612',
    mapLanduse1: '#1e2c16',
    mapLanduse2: '#222e18',
    mapHillshadeHighlight: '#46602e',
    mapHillshadeAccent: '#364a22',
    mapContour: '#3a521e',
    mapBuilding: '#283c18',
    mapRoadMinor: '#232e16',
    mapRoadMajor: '#303e1e',
    mapRoadHighway: '#445228',
    mapAdmin: '#627848',
    mapLabelCity: '#a8c87a',
    mapLabelCountry: '#bcd898',
    mapLabelHalo: '#111b0e',
    mapFog: {
      color: '#1a2820',
      'high-color': '#3a5a32',
      'space-color': '#050a08',
      'horizon-blend': 0.04,
      'star-intensity': 0.4,
    },
    // Gold/amber against the sage basemap — warm complement of forest greens.
    dataPalette: {
      designation: { National: '#fbbf24', International: '#fb923c' },
      iucn: {
        Ia:  '#78350f', Ib:  '#92400e', II:  '#b45309',
        III: '#d97706', IV:  '#f59e0b', V:   '#fbbf24', VI: '#fde68a',
        'Not Reported':  '#9ca3af',
        'Not Applicable':'#a8a29e',
        'Not Assigned':  '#d6d3d1',
      },
      status: { Designated: '#fbbf24', Established: '#f59e0b', Inscribed: '#fb923c' },
      governance: {
        'Federal or national ministry or agency': '#f59e0b',
        'Sub-national ministry or agency':        '#fb923c',
        'Collaborative governance':               '#f87171',
        'Joint governance':                       '#ec4899',
        'Individual landowners':                  '#d946ef',
        'Non-profit organisations':               '#fbbf24',
        'Not Reported':                           '#9ca3af',
      },
      default: '#fbbf24',
    },
  },
}

const DARK_EARTH: UiTheme = {
  id: 'dark-earth',
  label: 'Dark Earth',
  previewGradient: 'linear-gradient(135deg, #1c1410, #2e2215)',
  previewDot: '#a57637',
  palette: {
    bgDeepRgb: '28, 20, 16',
    bgRichRgb: '46, 34, 21',
    bgWarmRgb: '64, 46, 24',
    accentRgb: '165, 118, 55',
    accentHex: '#966228',
    activeStart: '#966228',
    activeEnd: '#744820',
    activeBorder: '#a87230',
    activeRgb: '150, 98, 40',
    textPrimary: '#eed8a8',
    textSecondary: '#c8a870',
    textLight: '#dcc090',
    textMuted: '#9a7850',
    textMed: '#b09060',
    sliderStart: '#c8922e',
    sliderEnd: '#966228',
    sliderGlowRgb: '200, 146, 46',
    titleStart: '#f0cc68',
    titleMid: '#d8a830',
    titleEnd: '#b07820',
    globeGlowRgb: '200, 150, 58',
    globeAccentRgb: '220, 170, 80',
    popupTipColor: 'rgba(46, 34, 21, 0.98)',
    optionBg: '#2e2215',
    ctrlIconFilter: 'invert(0.75) sepia(1) saturate(2) hue-rotate(20deg)',
    mapBg: '#1c1410',
    mapWater: '#1a2838',
    mapLandcover: '#221c0e',
    mapLanduse1: '#271e0c',
    mapLanduse2: '#2c210e',
    mapHillshadeHighlight: '#5c4a22',
    mapHillshadeAccent: '#3e3018',
    mapContour: '#4c3c20',
    mapBuilding: '#3c2e18',
    mapRoadMinor: '#2c2412',
    mapRoadMajor: '#3c3016',
    mapRoadHighway: '#5a4824',
    mapAdmin: '#7a6840',
    mapLabelCity: '#c8a870',
    mapLabelCountry: '#dcc090',
    mapLabelHalo: '#1c1410',
    mapFog: {
      color: '#2a1d10',
      'high-color': '#5a3e1c',
      'space-color': '#0a0805',
      'horizon-blend': 0.04,
      'star-intensity': 0.4,
    },
    // Teal/cyan against the warm earth basemap — cool complement of browns/golds.
    dataPalette: {
      designation: { National: '#14b8a6', International: '#0ea5e9' },
      iucn: {
        Ia:  '#134e4a', Ib:  '#115e59', II:  '#0f766e',
        III: '#0d9488', IV:  '#14b8a6', V:   '#2dd4bf', VI: '#5eead4',
        'Not Reported':  '#94a3b8',
        'Not Applicable':'#a1a1aa',
        'Not Assigned':  '#d4d4d8',
      },
      status: { Designated: '#14b8a6', Established: '#06b6d4', Inscribed: '#0ea5e9' },
      governance: {
        'Federal or national ministry or agency': '#0ea5e9',
        'Sub-national ministry or agency':        '#06b6d4',
        'Collaborative governance':               '#6366f1',
        'Joint governance':                       '#8b5cf6',
        'Individual landowners':                  '#a855f7',
        'Non-profit organisations':               '#14b8a6',
        'Not Reported':                           '#94a3b8',
      },
      default: '#14b8a6',
    },
  },
}

const SLATE_MIST: UiTheme = {
  id: 'slate-mist',
  label: 'Slate Mist',
  previewGradient: 'linear-gradient(135deg, #0f1820, #162230)',
  previewDot: '#468caa',
  palette: {
    bgDeepRgb: '15, 24, 32',
    bgRichRgb: '22, 34, 48',
    bgWarmRgb: '30, 46, 62',
    accentRgb: '70, 140, 170',
    accentHex: '#2a6880',
    activeStart: '#2a6880',
    activeEnd: '#1c4c60',
    activeBorder: '#3a7890',
    activeRgb: '42, 104, 128',
    textPrimary: '#c8e0ec',
    textSecondary: '#8ab8cc',
    textLight: '#a8ccd8',
    textMuted: '#5a8898',
    textMed: '#78a8b8',
    sliderStart: '#4a9ab8',
    sliderEnd: '#2a6880',
    sliderGlowRgb: '74, 154, 184',
    titleStart: '#6ad4ec',
    titleMid: '#3aaac8',
    titleEnd: '#1a7a98',
    globeGlowRgb: '74, 180, 210',
    globeAccentRgb: '100, 195, 225',
    popupTipColor: 'rgba(22, 34, 48, 0.98)',
    optionBg: '#162230',
    ctrlIconFilter: 'invert(0.75) sepia(0.5) saturate(3) hue-rotate(170deg)',
    mapBg: '#0f1820',
    mapWater: '#0a1830',
    mapLandcover: '#141e2c',
    mapLanduse1: '#18222e',
    mapLanduse2: '#1c2632',
    mapHillshadeHighlight: '#2a4058',
    mapHillshadeAccent: '#1a2c40',
    mapContour: '#243444',
    mapBuilding: '#1c2c3c',
    mapRoadMinor: '#182434',
    mapRoadMajor: '#203040',
    mapRoadHighway: '#2c404e',
    mapAdmin: '#446070',
    mapLabelCity: '#8ab8cc',
    mapLabelCountry: '#a8ccd8',
    mapLabelHalo: '#0f1820',
    mapFog: {
      color: '#15283c',
      'high-color': '#2c5878',
      'space-color': '#050810',
      'horizon-blend': 0.05,
      'star-intensity': 0.55,
    },
    // Coral/orange against the cool slate basemap — warm complement of blues/grays.
    dataPalette: {
      designation: { National: '#f97316', International: '#fbbf24' },
      iucn: {
        Ia:  '#7c2d12', Ib:  '#9a3412', II:  '#c2410c',
        III: '#ea580c', IV:  '#f97316', V:   '#fb923c', VI: '#fdba74',
        'Not Reported':  '#94a3b8',
        'Not Applicable':'#a1a1aa',
        'Not Assigned':  '#d4d4d8',
      },
      status: { Designated: '#f97316', Established: '#fb923c', Inscribed: '#fbbf24' },
      governance: {
        'Federal or national ministry or agency': '#f97316',
        'Sub-national ministry or agency':        '#fb923c',
        'Collaborative governance':               '#fbbf24',
        'Joint governance':                       '#facc15',
        'Individual landowners':                  '#fb7185',
        'Non-profit organisations':               '#ef4444',
        'Not Reported':                           '#94a3b8',
      },
      default: '#f97316',
    },
  },
}

// Palette source: Organic #6A6F4C · Butter #CBB89D · Coconut #EDE1D2
//                 Natural #806044  · Palm Oil #5D2510 · Cocoa #412F26
const BOTANICA: UiTheme = {
  id: 'botanica',
  label: 'Botanica',
  previewGradient: 'linear-gradient(135deg, #231810, #412F26)',
  previewDot: '#6A6F4C',
  palette: {
    // Backgrounds — darkened Cocoa → Cocoa → mid Natural
    bgDeepRgb: '35, 24, 16',     // #231810
    bgRichRgb: '65, 47, 38',     // #412F26  Cocoa
    bgWarmRgb: '90, 58, 40',     // #5a3a28

    // Organic olive green as the interactive accent
    accentRgb: '106, 111, 76',   // #6A6F4C  Organic
    accentHex: '#6A6F4C',

    // Palm Oil as active/selected state
    activeStart: '#7a3018',
    activeEnd: '#5D2510',        // Palm Oil
    activeBorder: '#8a3a20',
    activeRgb: '93, 37, 16',     // #5D2510

    // Text — Coconut → Butter → Natural hierarchy
    textPrimary: '#EDE1D2',      // Coconut
    textSecondary: '#CBB89D',    // Butter
    textLight: '#d8c8b0',        // between Coconut and Butter
    textMuted: '#806044',        // Natural
    textMed: '#a88060',          // between Natural and Butter

    // Slider in Natural → Palm Oil warmth
    sliderStart: '#a07050',
    sliderEnd: '#6a3820',
    sliderGlowRgb: '128, 96, 68',

    // Title: Coconut cream → Butter glow
    titleStart: '#f0e4d0',
    titleMid: '#CBB89D',         // Butter
    titleEnd: '#a08060',

    globeGlowRgb: '203, 184, 157',   // Butter
    globeAccentRgb: '237, 225, 210',  // Coconut

    popupTipColor: 'rgba(65, 47, 38, 0.98)',  // Cocoa
    optionBg: '#412F26',                       // Cocoa

    // Olive/warm icon tint (Organic green hue ~65°)
    ctrlIconFilter: 'invert(0.72) sepia(1) saturate(1.2) hue-rotate(55deg)',

    // Map — deep Cocoa land, navy water for contrast
    mapBg: '#1a1008',
    mapWater: '#182030',
    mapLandcover: '#231810',
    mapLanduse1: '#2a2015',      // park / grass — hint of Organic
    mapLanduse2: '#2e221a',      // hospital / school
    mapHillshadeHighlight: '#5a4030',
    mapHillshadeAccent: '#3a2818',
    mapContour: '#4a3020',
    mapBuilding: '#382618',
    mapRoadMinor: '#2e1e14',
    mapRoadMajor: '#3e2818',
    mapRoadHighway: '#5D2510',   // Palm Oil — highways pop subtly
    mapAdmin: '#6A6F4C',         // Organic — admin lines in olive
    mapLabelCity: '#CBB89D',     // Butter
    mapLabelCountry: '#EDE1D2',  // Coconut
    mapLabelHalo: '#1a1008',
    mapFog: {
      color: '#2a1812',          // dark Cocoa horizon
      'high-color': '#5D2510',   // Palm Oil upper atmosphere
      'space-color': '#0a0604',  // near-black cocoa void
      'horizon-blend': 0.04,
      'star-intensity': 0.4,
    },
    // Lime/butter — extends the Organic olive accent into a brighter ramp so
    // parks pop against the dark Cocoa basemap. Higher categories tip into
    // Butter/Coconut for continuity with the rest of the palette.
    dataPalette: {
      designation: { National: '#a3e635', International: '#fbbf24' },
      iucn: {
        Ia:  '#365314', Ib:  '#3f6212', II:  '#4d7c0f',
        III: '#65a30d', IV:  '#84cc16', V:   '#a3e635', VI: '#d9f99d',
        'Not Reported':  '#a8a29e',
        'Not Applicable':'#b8a890',
        'Not Assigned':  '#d6c8b0',
      },
      status: { Designated: '#a3e635', Established: '#84cc16', Inscribed: '#fbbf24' },
      governance: {
        'Federal or national ministry or agency': '#84cc16',
        'Sub-national ministry or agency':        '#a3e635',
        'Collaborative governance':               '#facc15',
        'Joint governance':                       '#fbbf24',
        'Individual landowners':                  '#fb923c',
        'Non-profit organisations':               '#f87171',
        'Not Reported':                           '#a8a29e',
      },
      default: '#a3e635',
    },
  },
}

export const UI_THEMES: UiTheme[] = [SAGE_FOREST, DARK_EARTH, SLATE_MIST, BOTANICA]

export const DEFAULT_UI_THEME_ID = 'sage-forest'

export function getUiTheme(id: string): UiTheme {
  return UI_THEMES.find(t => t.id === id) ?? UI_THEMES[0]
}

// ─── Apply theme to DOM ───────────────────────────────────────────────────────

export function applyUiTheme(theme: UiTheme): void {
  const el = document.documentElement
  const p = theme.palette
  el.style.setProperty('--bg-deep-rgb', p.bgDeepRgb)
  el.style.setProperty('--bg-rich-rgb', p.bgRichRgb)
  el.style.setProperty('--bg-warm-rgb', p.bgWarmRgb)
  el.style.setProperty('--accent-rgb', p.accentRgb)
  el.style.setProperty('--accent-hex', p.accentHex)
  el.style.setProperty('--active-start', p.activeStart)
  el.style.setProperty('--active-end', p.activeEnd)
  el.style.setProperty('--active-border', p.activeBorder)
  el.style.setProperty('--active-rgb', p.activeRgb)
  el.style.setProperty('--text-primary', p.textPrimary)
  el.style.setProperty('--text-secondary', p.textSecondary)
  el.style.setProperty('--text-light', p.textLight)
  el.style.setProperty('--text-muted', p.textMuted)
  el.style.setProperty('--text-med', p.textMed)
  el.style.setProperty('--slider-start', p.sliderStart)
  el.style.setProperty('--slider-end', p.sliderEnd)
  el.style.setProperty('--slider-glow-rgb', p.sliderGlowRgb)
  el.style.setProperty('--title-start', p.titleStart)
  el.style.setProperty('--title-mid', p.titleMid)
  el.style.setProperty('--title-end', p.titleEnd)
  el.style.setProperty('--globe-glow-rgb', p.globeGlowRgb)
  el.style.setProperty('--globe-accent-rgb', p.globeAccentRgb)
  el.style.setProperty('--popup-tip-color', p.popupTipColor)
  el.style.setProperty('--option-bg', p.optionBg)
  el.style.setProperty('--ctrl-icon-filter', p.ctrlIconFilter)
}

// ─── Globe atmosphere / space styling ────────────────────────────────────────

// Applies the theme's `mapFog` config to the live map. Safe to call on any
// style (Mapbox-hosted or our custom 'earth' style) and at any time —
// `setFog` does not require the style to be reloaded.
export function applyMapFog(map: MapboxMap, palette: UiPalette): void {
  map.setFog(palette.mapFog as FogSpecification)
}

// ─── Mapbox custom style builder ──────────────────────────────────────────────

export function buildCustomMapStyle(palette: UiPalette): StyleSpecification {
  const p = palette
  return {
    version: 8,
    name: 'Custom',
    sources: {
      'mapbox-streets': {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-streets-v8',
      },
    },
    sprite: 'mapbox://sprites/mapbox/dark-v11',
    glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': p.mapBg } },
      { id: 'water', type: 'fill', source: 'mapbox-streets', 'source-layer': 'water', paint: { 'fill-color': p.mapWater } },
      { id: 'landcover', type: 'fill', source: 'mapbox-streets', 'source-layer': 'landcover', paint: { 'fill-color': p.mapLandcover, 'fill-opacity': 0.5 } },
      {
        id: 'landuse', type: 'fill', source: 'mapbox-streets', 'source-layer': 'landuse',
        paint: {
          'fill-color': ['match', ['get', 'class'],
            ['park', 'grass', 'cemetery'], p.mapLanduse1,
            ['hospital', 'school'], p.mapLanduse2,
            p.mapLandcover,
          ],
          'fill-opacity': 0.6,
        },
      },
      {
        id: 'hillshade', type: 'hillshade', source: 'mapbox-streets', 'source-layer': 'hillshade',
        paint: { 'hillshade-shadow-color': p.mapBg, 'hillshade-highlight-color': p.mapHillshadeHighlight, 'hillshade-accent-color': p.mapHillshadeAccent },
      },
      { id: 'contour', type: 'line', source: 'mapbox-streets', 'source-layer': 'contour', paint: { 'line-color': p.mapContour, 'line-opacity': 0.3, 'line-width': 0.5 } },
      { id: 'building', type: 'fill', source: 'mapbox-streets', 'source-layer': 'building', minzoom: 14, paint: { 'fill-color': p.mapBuilding, 'fill-opacity': 0.8 } },
      { id: 'road-minor', type: 'line', source: 'mapbox-streets', 'source-layer': 'road', minzoom: 14, filter: ['in', 'class', 'street', 'street_limited', 'service', 'track'], paint: { 'line-color': p.mapRoadMinor, 'line-width': 0.5, 'line-opacity': 0.4 } },
      { id: 'road-major', type: 'line', source: 'mapbox-streets', 'source-layer': 'road', minzoom: 10, filter: ['in', 'class', 'primary', 'secondary', 'tertiary'], paint: { 'line-color': p.mapRoadMajor, 'line-width': 1, 'line-opacity': 0.5 } },
      { id: 'road-highway', type: 'line', source: 'mapbox-streets', 'source-layer': 'road', minzoom: 6, filter: ['==', 'class', 'motorway'], paint: { 'line-color': p.mapRoadHighway, 'line-width': 1.5, 'line-opacity': 0.6 } },
      { id: 'admin-boundaries', type: 'line', source: 'mapbox-streets', 'source-layer': 'admin', filter: ['>=', 'admin_level', 2], paint: { 'line-color': p.mapAdmin, 'line-width': 1, 'line-dasharray': [2, 2] } },
      {
        id: 'place-labels', type: 'symbol', source: 'mapbox-streets', 'source-layer': 'place_label',
        filter: ['in', 'class', 'city', 'town'],
        layout: { 'text-field': ['get', 'name'], 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 10, 16] },
        paint: { 'text-color': p.mapLabelCity, 'text-halo-color': p.mapLabelHalo, 'text-halo-width': 1.5 },
      },
      {
        id: 'country-labels', type: 'symbol', source: 'mapbox-streets', 'source-layer': 'place_label',
        filter: ['==', 'class', 'country'],
        layout: { 'text-field': ['get', 'name'], 'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 6, 18] },
        paint: { 'text-color': p.mapLabelCountry, 'text-halo-color': p.mapLabelHalo, 'text-halo-width': 2 },
      },
    ],
  }
}

// ─── Live paint updates (no style reload) ────────────────────────────────────

export type LayerPaintUpdate = { layerId: string; property: string; value: unknown }

export function getCustomLayerPaints(palette: UiPalette): LayerPaintUpdate[] {
  const p = palette
  const landuse: unknown = ['match', ['get', 'class'],
    ['park', 'grass', 'cemetery'], p.mapLanduse1,
    ['hospital', 'school'], p.mapLanduse2,
    p.mapLandcover,
  ]
  return [
    { layerId: 'background',       property: 'background-color',         value: p.mapBg },
    { layerId: 'water',            property: 'fill-color',                value: p.mapWater },
    { layerId: 'landcover',        property: 'fill-color',                value: p.mapLandcover },
    { layerId: 'landuse',          property: 'fill-color',                value: landuse },
    { layerId: 'hillshade',        property: 'hillshade-shadow-color',    value: p.mapBg },
    { layerId: 'hillshade',        property: 'hillshade-highlight-color', value: p.mapHillshadeHighlight },
    { layerId: 'hillshade',        property: 'hillshade-accent-color',    value: p.mapHillshadeAccent },
    { layerId: 'contour',          property: 'line-color',                value: p.mapContour },
    { layerId: 'building',         property: 'fill-color',                value: p.mapBuilding },
    { layerId: 'road-minor',       property: 'line-color',                value: p.mapRoadMinor },
    { layerId: 'road-major',       property: 'line-color',                value: p.mapRoadMajor },
    { layerId: 'road-highway',     property: 'line-color',                value: p.mapRoadHighway },
    { layerId: 'admin-boundaries', property: 'line-color',                value: p.mapAdmin },
    { layerId: 'place-labels',     property: 'text-color',                value: p.mapLabelCity },
    { layerId: 'place-labels',     property: 'text-halo-color',           value: p.mapLabelHalo },
    { layerId: 'country-labels',   property: 'text-color',                value: p.mapLabelCountry },
    { layerId: 'country-labels',   property: 'text-halo-color',           value: p.mapLabelHalo },
  ]
}
