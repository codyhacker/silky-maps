import type { Expression } from 'mapbox-gl'

// Per-UI-theme data colors. Each UI theme owns its own data palette so the
// parks layer can contrast the basemap while staying coordinated with the rest
// of the chrome. See `uiThemes.ts` for the four concrete palettes.
//
// Keys mirror the categorical values in the WDPA dataset. A `default` color
// covers any value not enumerated.
export interface ThemeDataPalette {
  designation: {
    National: string
    International: string
  }
  iucn: {
    Ia: string
    Ib: string
    II: string
    III: string
    IV: string
    V: string
    VI: string
    'Not Reported': string
    'Not Applicable': string
    'Not Assigned': string
  }
  status: {
    Designated: string
    Established: string
    Inscribed: string
  }
  governance: {
    'Federal or national ministry or agency': string
    'Sub-national ministry or agency': string
    'Collaborative governance': string
    'Joint governance': string
    'Individual landowners': string
    'Non-profit organisations': string
    'Not Reported': string
  }
  default: string
}

export interface ThemeOption {
  label: string
  property: string
  colors: Record<string, string>
  defaultColor: string
}

// Static label/property pairs — used by chrome that only needs labels (e.g.
// the "Color by" segmented control) without instantiating a full options
// array bound to a palette.
export const THEME_LABELS: { label: string; property: string }[] = [
  { label: 'Designation Type', property: 'DESIG_TYPE' },
  { label: 'IUCN Category',    property: 'IUCN_CAT'   },
  { label: 'Status',           property: 'STATUS'     },
  { label: 'Governance',       property: 'GOV_TYPE'   },
]

// Builds the per-theme color map array from a UI theme's `dataPalette`.
// Order matches THEME_LABELS so callers can index by `selectedTheme`.
export function buildThemeOptions(palette: ThemeDataPalette): ThemeOption[] {
  return [
    { label: 'Designation Type', property: 'DESIG_TYPE', colors: palette.designation, defaultColor: palette.default },
    { label: 'IUCN Category',    property: 'IUCN_CAT',   colors: palette.iucn,        defaultColor: palette.default },
    { label: 'Status',           property: 'STATUS',     colors: palette.status,      defaultColor: palette.default },
    { label: 'Governance',       property: 'GOV_TYPE',   colors: palette.governance,  defaultColor: palette.default },
  ]
}

export function lightenColor(hex: string, amount: number = 0.3): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.round(((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * amount))
  const g = Math.min(255, Math.round(((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * amount))
  const b = Math.min(255, Math.round((num & 0xff) + (255 - (num & 0xff)) * amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export function buildColorExpression(theme: ThemeOption): Expression {
  const entries: (string | string[])[] = ['match', ['get', theme.property]]
  for (const [value, color] of Object.entries(theme.colors)) {
    entries.push(value, color)
  }
  entries.push(theme.defaultColor)
  return entries as Expression
}

export function buildOutlineColorExpression(theme: ThemeOption): Expression {
  const entries: (string | string[])[] = ['match', ['get', theme.property]]
  for (const [value, color] of Object.entries(theme.colors)) {
    entries.push(value, lightenColor(color, 0.4))
  }
  entries.push(lightenColor(theme.defaultColor, 0.4))
  return entries as Expression
}
