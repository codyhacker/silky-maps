import type { StyleSpecification } from 'mapbox-gl'

export interface BasemapOption {
  id: string
  label: string
  previewColor: string  // CSS gradient string for swatch thumbnail
  // null = custom style built dynamically from the active UiTheme palette
  style: string | StyleSpecification | null
}

export const BASEMAP_OPTIONS: BasemapOption[] = [
  { id: 'earth',     label: 'Earth',     previewColor: 'linear-gradient(135deg,#1a2e1a,#2a4a28)', style: null },
  { id: 'satellite', label: 'Satellite', previewColor: 'linear-gradient(135deg,#1a2a18,#263c22)',  style: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { id: 'dark',      label: 'Dark',      previewColor: 'linear-gradient(135deg,#1a1a24,#2a2a38)',  style: 'mapbox://styles/mapbox/dark-v11' },
  { id: 'light',     label: 'Light',     previewColor: 'linear-gradient(135deg,#d8d8cc,#e8e8dc)',  style: 'mapbox://styles/mapbox/light-v11' },
  { id: 'outdoors',  label: 'Outdoors',  previewColor: 'linear-gradient(135deg,#c8d8a8,#a8c080)',  style: 'mapbox://styles/mapbox/outdoors-v12' },
]
