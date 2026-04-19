import type { Expression } from 'mapbox-gl'

export interface ThemeOption {
  label: string
  property: string
  colors: Record<string, string>
}

export const THEME_OPTIONS: ThemeOption[] = [
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

export const DEFAULT_COLOR = '#22c55e'

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
  entries.push(DEFAULT_COLOR)
  return entries as Expression
}

export function buildOutlineColorExpression(theme: ThemeOption): Expression {
  const entries: (string | string[])[] = ['match', ['get', theme.property]]
  for (const [value, color] of Object.entries(theme.colors)) {
    entries.push(value, lightenColor(color, 0.4))
  }
  entries.push(lightenColor(DEFAULT_COLOR, 0.4))
  return entries as Expression
}
