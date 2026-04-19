import { createSelector } from '@reduxjs/toolkit'
import type { LayerSpecification, SourceSpecification } from 'mapbox-gl'
import type { RootState } from '../../../app/store'
import { buildThemeOptions, buildColorExpression, buildOutlineColorExpression } from '../../../shared/constants/dataPalettes'
import { getUiTheme } from '../../../shared/constants/uiThemes'

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
    (s: RootState) => s.mapStyle.selectedUiTheme,
    (s: RootState) => s.parksFilter.selectedCategory,
    (s: RootState) => s.parksFilter.selectedDesignation,
    (s: RootState) => s.terrain.terrainExaggeration,
  ],
  (selectedTheme, fillOpacity, selectedUiTheme, selectedCategory, selectedDesignation, terrainExaggeration): AugmentationSpec => {
    const dataPalette = getUiTheme(selectedUiTheme).palette.dataPalette
    const theme = buildThemeOptions(dataPalette)[selectedTheme]

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
            // `selected` flips the fill off entirely so a touring park reads
            // as just an outline against the basemap. `hover` still bumps
            // opacity for non-selected features.
            'fill-opacity': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 0,
              ['boolean', ['feature-state', 'hover'], false], Math.min(fillOpacity + 0.3, 1),
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
            // Selected parks get a thicker stroke since the fill is gone and
            // we want the boundary to read clearly during the orbit tour.
            'line-width': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 2.5,
              ['boolean', ['feature-state', 'hover'], false], 2,
              0.8,
            ],
            'line-opacity': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 1,
              0.9,
            ],
          },
        } as LayerSpecification,
      ],
      ...(terrainExaggeration > 0 ? { terrain: { source: 'mapbox-dem', exaggeration: terrainExaggeration } } : {}),
    }
  }
)
