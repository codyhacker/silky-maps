import { createSelector } from '@reduxjs/toolkit'
import type { LayerSpecification, SourceSpecification } from 'mapbox-gl'
import type { RootState } from '../../app/store'
import { THEME_OPTIONS, buildColorExpression, buildOutlineColorExpression } from '../../shared/constants/themes'

const PMTILES_URL = import.meta.env.VITE_PMTILES_URL || 'http://localhost:8080/wdpa.pmtiles'
const SOURCE_LAYER = 'geo'

export interface AugmentationSpec {
  version: 8
  sources: Record<string, SourceSpecification>
  layers: LayerSpecification[]
  terrain?: { source: string; exaggeration: number }
}

export const selectAugmentationSpec = createSelector(
  [
    (s: RootState) => s.mapStyle.selectedTheme,
    (s: RootState) => s.mapStyle.fillOpacity,
    (s: RootState) => s.mapFilter.selectedCategory,
    (s: RootState) => s.mapFilter.selectedDesignation,
    (s: RootState) => s.terrain.terrainExaggeration,
  ],
  (selectedTheme, fillOpacity, selectedCategory, selectedDesignation, terrainExaggeration): AugmentationSpec => {
    const theme = THEME_OPTIONS[selectedTheme]

    const conditions: unknown[] = []
    if (selectedCategory !== 'all') conditions.push(['==', ['get', 'DESIG_TYPE'], selectedCategory])
    if (selectedDesignation !== 'all') conditions.push(['==', ['get', 'DESIG'], selectedDesignation])
    const filter = conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : ['all', ...conditions]

    return {
      version: 8,
      sources: {
        'mapbox-dem': {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        } as SourceSpecification,
        'national-parks': {
          type: 'vector',
          url: PMTILES_URL,
          promoteId: 'SITE_PID',
        } as SourceSpecification,
      },
      layers: [
        {
          id: 'parks-fill',
          type: 'fill',
          source: 'national-parks',
          'source-layer': SOURCE_LAYER,
          ...(filter ? { filter } : {}),
          paint: {
            'fill-color': buildColorExpression(theme),
            'fill-opacity': [
              'case',
              ['boolean', ['feature-state', 'hover'], false],
              Math.min(fillOpacity + 0.3, 1),
              fillOpacity,
            ],
          },
        } as LayerSpecification,
        {
          id: 'parks-outline',
          type: 'line',
          source: 'national-parks',
          'source-layer': SOURCE_LAYER,
          ...(filter ? { filter } : {}),
          paint: {
            'line-color': buildOutlineColorExpression(theme),
            'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2, 0.8],
            'line-opacity': 0.9,
          },
        } as LayerSpecification,
      ],
      ...(terrainExaggeration > 0 ? { terrain: { source: 'mapbox-dem', exaggeration: terrainExaggeration } } : {}),
    }
  }
)
