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

  // Cross-hue earthy secondary accent (dusty amber / olive / warm sand per theme)
  accentWarmHex: string
  accentWarmRgb: string    // "R, G, B" for rgba() usage

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

  // Hiking trails — overlays drawn on top of the basemap. Casing is the
  // wider darker underlay (gives the line a "ribbon" look on busy
  // landcover); thru is the accent color for named long-distance routes
  // (PCT, AT, GR…); halo is the label outline color (usually `mapBg`
  // so labels punch through the surrounding basemap cleanly).
  mapTrail: string
  mapTrailCasing: string
  mapTrailThru: string
  mapTrailHalo: string

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
  lightPalette?: UiPalette
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
    accentWarmHex: '#9a7230',
    accentWarmRgb: '154, 114, 48',
    mapBg: '#0d1a0a',
    mapWater: '#1e3a58',
    mapLandcover: '#18250e',
    mapLanduse1: '#3a5a24',
    mapLanduse2: '#1c2612',
    mapHillshadeHighlight: '#6a8c3e',
    mapHillshadeAccent: '#2a3818',
    mapContour: '#5a7a2c',
    mapBuilding: '#1c2410',
    mapRoadMinor: '#2a3818',
    mapRoadMajor: '#3c5022',
    mapRoadHighway: '#6a8438',
    mapAdmin: '#627848',
    mapLabelCity: '#a8c87a',
    mapLabelCountry: '#bcd898',
    mapLabelHalo: '#111b0e',
    // Cool blue against the amber park ramp — clear hue separation so
    // trails read as a distinct layer from park polygon fills.
    mapTrail: '#60a5fa',
    mapTrailCasing: '#0d1a0a',
    mapTrailThru: '#a78bfa',
    mapTrailHalo: '#0d1a0a',
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
    accentWarmHex: '#528442',
    accentWarmRgb: '82, 132, 66',
    mapBg: '#1a1109',
    mapWater: '#1c3a58',
    mapLandcover: '#1e1a0a',
    mapLanduse1: '#4a4a1c',
    mapLanduse2: '#241a0a',
    mapHillshadeHighlight: '#8a7030',
    mapHillshadeAccent: '#3a2a12',
    mapContour: '#6a5224',
    mapBuilding: '#2c2010',
    mapRoadMinor: '#332816',
    mapRoadMajor: '#4a3a1c',
    mapRoadHighway: '#8a6a2c',
    mapAdmin: '#7a6840',
    mapLabelCity: '#c8a870',
    mapLabelCountry: '#dcc090',
    mapLabelHalo: '#1c1410',
    // Warm amber against the teal park ramp — clear hue separation so
    // trails read as a distinct layer from park polygon fills.
    mapTrail: '#f59e0b',
    mapTrailCasing: '#1a1109',
    mapTrailThru: '#fb923c',
    mapTrailHalo: '#1a1109',
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
    accentWarmHex: '#987228',
    accentWarmRgb: '152, 114, 40',
    mapBg: '#0d1620',
    mapWater: '#1a3a5c',
    mapLandcover: '#121d28',
    mapLanduse1: '#2a4a30',
    mapLanduse2: '#161e28',
    mapHillshadeHighlight: '#4e7090',
    mapHillshadeAccent: '#162436',
    mapContour: '#3e5a76',
    mapBuilding: '#162230',
    mapRoadMinor: '#1e2c3c',
    mapRoadMajor: '#344a60',
    mapRoadHighway: '#4e6e88',
    mapAdmin: '#446070',
    mapLabelCity: '#8ab8cc',
    mapLabelCountry: '#a8ccd8',
    mapLabelHalo: '#0f1820',
    // Emerald against the orange park ramp — clear hue separation so
    // trails read as a distinct layer from park polygon fills.
    mapTrail: '#34d399',
    mapTrailCasing: '#0d1620',
    mapTrailThru: '#22d3ee',
    mapTrailHalo: '#0d1620',
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
    accentWarmHex: '#6A6F4C',
    accentWarmRgb: '106, 111, 76',

    // Map — deep Cocoa land, navy water for contrast
    mapBg: '#180e06',
    mapWater: '#1a2f4a',
    mapLandcover: '#1e1409',
    mapLanduse1: '#4a5220',      // park / grass — Organic olive pops
    mapLanduse2: '#1e140a',      // hospital / school — recessive
    mapHillshadeHighlight: '#8a6440',
    mapHillshadeAccent: '#3a2416',
    mapContour: '#6a4828',
    mapBuilding: '#2c1a0e',
    mapRoadMinor: '#34220e',
    mapRoadMajor: '#4a3018',
    mapRoadHighway: '#8a3818',   // Palm Oil brightened — highway hierarchy reads
    mapAdmin: '#6A6F4C',         // Organic — admin lines in olive
    mapLabelCity: '#CBB89D',     // Butter
    mapLabelCountry: '#EDE1D2',  // Coconut
    mapLabelHalo: '#1a1008',
    // Orange against the lime park ramp — clear hue separation so
    // trails read as a distinct layer from park polygon fills.
    mapTrail: '#fb923c',
    mapTrailCasing: '#180e06',
    mapTrailThru: '#fbbf24',
    mapTrailHalo: '#180e06',
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

// ─── Light palettes ───────────────────────────────────────────────────────────
// Each light palette is a lighter expression of the same two-colour story.
// Map colours are derived to match — same hue family, brighter background.

const SAGE_LIGHT: UiPalette = {
  bgDeepRgb: '236, 248, 230',
  bgRichRgb: '220, 238, 212',
  bgWarmRgb: '200, 228, 190',
  accentRgb: '58, 100, 55',
  accentHex: '#3a6437',
  activeStart: '#5e4016',
  activeEnd: '#4a3010',
  activeBorder: '#7a5820',
  activeRgb: '94, 64, 22',
  textPrimary: '#1c3a1c',
  textSecondary: '#3a6437',
  textLight: '#2a5028',
  textMuted: '#487248',
  textMed: '#3a5c38',
  sliderStart: '#7a5820',
  sliderEnd: '#5e4016',
  sliderGlowRgb: '122, 88, 32',
  titleStart: '#1c3a1c',
  titleMid: '#3a6437',
  titleEnd: '#5a8457',
  globeGlowRgb: '58, 100, 55',
  globeAccentRgb: '80, 130, 75',
  popupTipColor: 'rgba(220, 238, 212, 0.98)',
  optionBg: '#dceedd',
  ctrlIconFilter: 'invert(0.2) sepia(0.5) saturate(1.5) hue-rotate(65deg)',
  accentWarmHex: '#7a5820',
  accentWarmRgb: '122, 88, 32',
  mapBg: '#e4ecdc',
  mapWater: '#3a6a8c',
  mapLandcover: '#cce0bc',
  mapLanduse1: '#9abf7c',
  mapLanduse2: '#d0dcbc',
  mapHillshadeHighlight: '#b8d0a4',
  mapHillshadeAccent: '#7a9868',
  mapContour: '#6e8e54',
  mapBuilding: '#d8dcc4',
  mapRoadMinor: '#8ca478',
  mapRoadMajor: '#6a8658',
  mapRoadHighway: '#3a5820',
  mapAdmin: '#587048',
  mapLabelCity: '#3a6437',
  mapLabelCountry: '#1c3a1c',
  mapLabelHalo: '#ddecd5',
  // Deep blue against the amber park ramp on a pale sage basemap.
  mapTrail: '#1d4ed8',
  mapTrailCasing: '#e4ecdc',
  mapTrailThru: '#4338ca',
  mapTrailHalo: '#e4ecdc',
  mapFog: { color: '#c8dcc0', 'high-color': '#a0c090', 'space-color': '#4a7040', 'horizon-blend': 0.06, 'star-intensity': 0.1 },
  dataPalette: SAGE_FOREST.palette.dataPalette,
}

const EARTH_LIGHT: UiPalette = {
  bgDeepRgb: '252, 242, 228',
  bgRichRgb: '238, 225, 205',
  bgWarmRgb: '222, 208, 182',
  accentRgb: '122, 68, 24',
  accentHex: '#7a4418',
  activeStart: '#244414',
  activeEnd: '#1c3410',
  activeBorder: '#3c6c2c',
  activeRgb: '36, 68, 20',
  textPrimary: '#2a1808',
  textSecondary: '#7a4418',
  textLight: '#5a3010',
  textMuted: '#744e28',
  textMed: '#5c3c18',
  sliderStart: '#3c6c2c',
  sliderEnd: '#244414',
  sliderGlowRgb: '60, 108, 44',
  titleStart: '#2a1808',
  titleMid: '#7a4418',
  titleEnd: '#a06030',
  globeGlowRgb: '122, 68, 24',
  globeAccentRgb: '160, 96, 40',
  popupTipColor: 'rgba(238, 225, 205, 0.98)',
  optionBg: '#fdf5e8',
  ctrlIconFilter: 'invert(0.2) sepia(1) saturate(2) hue-rotate(20deg)',
  accentWarmHex: '#3c6c2c',
  accentWarmRgb: '60, 108, 44',
  mapBg: '#f4e8d4',
  mapWater: '#3a5a7c',
  mapLandcover: '#d8caac',
  mapLanduse1: '#a8a868',
  mapLanduse2: '#dccfb0',
  mapHillshadeHighlight: '#d4b890',
  mapHillshadeAccent: '#8c7048',
  mapContour: '#8a6838',
  mapBuilding: '#d8c4a0',
  mapRoadMinor: '#a08c6c',
  mapRoadMajor: '#7a624a',
  mapRoadHighway: '#5a3a18',
  mapAdmin: '#785030',
  mapLabelCity: '#7a4418',
  mapLabelCountry: '#2a1808',
  mapLabelHalo: '#f0e2cc',
  mapTrail: '#b45309',
  mapTrailCasing: '#f4e8d4',
  mapTrailThru: '#92400e',
  mapTrailHalo: '#f4e8d4',
  mapFog: { color: '#d8c0a0', 'high-color': '#b89870', 'space-color': '#584020', 'horizon-blend': 0.06, 'star-intensity': 0.1 },
  dataPalette: DARK_EARTH.palette.dataPalette,
}

const MIST_LIGHT: UiPalette = {
  bgDeepRgb: '234, 242, 254',
  bgRichRgb: '215, 228, 248',
  bgWarmRgb: '194, 214, 242',
  accentRgb: '40, 68, 120',
  accentHex: '#284478',
  activeStart: '#524012',
  activeEnd: '#3c2e0c',
  activeBorder: '#785a18',
  activeRgb: '82, 64, 18',
  textPrimary: '#121c30',
  textSecondary: '#284478',
  textLight: '#1c2e50',
  textMuted: '#385480',
  textMed: '#2a4068',
  sliderStart: '#785a18',
  sliderEnd: '#524012',
  sliderGlowRgb: '120, 90, 24',
  titleStart: '#121c30',
  titleMid: '#284478',
  titleEnd: '#3a5888',
  globeGlowRgb: '40, 68, 120',
  globeAccentRgb: '70, 100, 160',
  popupTipColor: 'rgba(215, 228, 248, 0.98)',
  optionBg: '#eef4fe',
  ctrlIconFilter: 'invert(0.2) sepia(0.5) saturate(3) hue-rotate(170deg)',
  accentWarmHex: '#785a18',
  accentWarmRgb: '120, 90, 24',
  mapBg: '#e0eaf4',
  mapWater: '#2e5c8c',
  mapLandcover: '#c4d6e8',
  mapLanduse1: '#8cb298',
  mapLanduse2: '#ccdaea',
  mapHillshadeHighlight: '#b8ccdc',
  mapHillshadeAccent: '#6e8aa4',
  mapContour: '#6888a4',
  mapBuilding: '#c8d0dc',
  mapRoadMinor: '#8ca0b4',
  mapRoadMajor: '#647a94',
  mapRoadHighway: '#2e4662',
  mapAdmin: '#486078',
  mapLabelCity: '#284478',
  mapLabelCountry: '#121c30',
  mapLabelHalo: '#d8e6f5',
  mapTrail: '#166534',
  mapTrailCasing: '#e0eaf4',
  mapTrailThru: '#0f766e',
  mapTrailHalo: '#e0eaf4',
  mapFog: { color: '#b0c8e0', 'high-color': '#90aac8', 'space-color': '#284860', 'horizon-blend': 0.06, 'star-intensity': 0.1 },
  dataPalette: SLATE_MIST.palette.dataPalette,
}

const BOTANICA_LIGHT: UiPalette = {
  bgDeepRgb: '245, 238, 228',
  bgRichRgb: '233, 224, 210',
  bgWarmRgb: '218, 208, 192',
  accentRgb: '106, 111, 76',
  accentHex: '#6A6F4C',
  activeStart: '#7a3018',
  activeEnd: '#5D2510',
  activeBorder: '#8a3a20',
  activeRgb: '93, 37, 16',
  textPrimary: '#231810',
  textSecondary: '#6A6F4C',
  textLight: '#412F26',
  textMuted: '#806044',
  textMed: '#604830',
  sliderStart: '#8a3a20',
  sliderEnd: '#7a3018',
  sliderGlowRgb: '138, 58, 32',
  titleStart: '#231810',
  titleMid: '#6A6F4C',
  titleEnd: '#806044',
  globeGlowRgb: '106, 111, 76',
  globeAccentRgb: '140, 145, 100',
  popupTipColor: 'rgba(233, 224, 210, 0.98)',
  optionBg: '#f5eedc',
  ctrlIconFilter: 'invert(0.2) sepia(1) saturate(1.2) hue-rotate(55deg)',
  accentWarmHex: '#6A6F4C',
  accentWarmRgb: '106, 111, 76',
  mapBg: '#f4ece0',
  mapWater: '#3c5e84',
  mapLandcover: '#d8d0b8',
  mapLanduse1: '#8c9e5c',
  mapLanduse2: '#dcd2bc',
  mapHillshadeHighlight: '#d2bc9c',
  mapHillshadeAccent: '#887258',
  mapContour: '#8a6e44',
  mapBuilding: '#d8c6a8',
  mapRoadMinor: '#a09078',
  mapRoadMajor: '#786450',
  mapRoadHighway: '#6a2810',
  mapAdmin: '#6A6F4C',
  mapLabelCity: '#6A6F4C',
  mapLabelCountry: '#231810',
  mapLabelHalo: '#f0e8dc',
  mapTrail: '#9a3412',
  mapTrailCasing: '#f4ece0',
  mapTrailThru: '#7c2d12',
  mapTrailHalo: '#f4ece0',
  mapFog: { color: '#d8c8b0', 'high-color': '#c0a880', 'space-color': '#4a3828', 'horizon-blend': 0.06, 'star-intensity': 0.1 },
  dataPalette: BOTANICA.palette.dataPalette,
}

export const UI_THEMES: UiTheme[] = [
  { ...SAGE_FOREST,  lightPalette: SAGE_LIGHT },
  { ...DARK_EARTH,   lightPalette: EARTH_LIGHT },
  { ...SLATE_MIST,   lightPalette: MIST_LIGHT },
  { ...BOTANICA,     lightPalette: BOTANICA_LIGHT },
]

export const DEFAULT_UI_THEME_ID = 'sage-forest'

export function getUiTheme(id: string): UiTheme {
  return UI_THEMES.find(t => t.id === id) ?? UI_THEMES[0]
}

export function getEffectivePalette(theme: UiTheme, mode: 'dark' | 'light' = 'dark'): UiPalette {
  return mode === 'light' && theme.lightPalette ? theme.lightPalette : theme.palette
}

// ─── Apply theme to DOM ───────────────────────────────────────────────────────

export function applyUiTheme(palette: UiPalette): void {
  const el = document.documentElement
  const p = palette
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
  el.style.setProperty('--accent-warm-hex', p.accentWarmHex)
  el.style.setProperty('--accent-warm-rgb', p.accentWarmRgb)
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
      { id: 'contour', type: 'line', source: 'mapbox-streets', 'source-layer': 'contour', paint: { 'line-color': p.mapContour, 'line-opacity': 0.5, 'line-width': 0.5 } },
      { id: 'building', type: 'fill', source: 'mapbox-streets', 'source-layer': 'building', minzoom: 14, paint: { 'fill-color': p.mapBuilding, 'fill-opacity': 0.5 } },
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
