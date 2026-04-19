import type { StyleSpecification } from 'mapbox-gl'

export interface BasemapOption {
  id: string
  label: string
  // null = custom style built dynamically from the active UiTheme palette
  style: string | StyleSpecification | null
}

export const BASEMAP_OPTIONS: BasemapOption[] = [
  { id: 'earth',     label: 'Dark Earth',  style: null },
  { id: 'satellite', label: 'Satellite',   style: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { id: 'dark',      label: 'Dark',        style: 'mapbox://styles/mapbox/dark-v11' },
  { id: 'light',     label: 'Light',       style: 'mapbox://styles/mapbox/light-v11' },
  { id: 'outdoors',  label: 'Outdoors',    style: 'mapbox://styles/mapbox/outdoors-v12' },
]
