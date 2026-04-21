import { createSelector } from '@reduxjs/toolkit'
import type { LayerSpecification, SourceSpecification, ExpressionSpecification } from 'mapbox-gl'
import type { RootState } from '../../../app/store'
import { buildThemeOptions, buildColorExpression, buildOutlineColorExpression } from '../../../shared/constants/dataPalettes'
import { getUiTheme, getEffectivePalette } from '../../../shared/constants/uiThemes'

const PMTILES_URL = import.meta.env.VITE_PMTILES_URL || 'http://localhost:8080/wdpa.pmtiles'
// Trails are optional. When no URL is set we omit the source + every layer
// entirely so the user doesn't pay a failed PMTiles header fetch on a
// trails-less deployment. Hosting the trails archive is a separate one-off
// step (scripts/build-trails-pmtiles.sh + R2/S3 upload).
const TRAILS_PMTILES_URL = import.meta.env.VITE_TRAILS_PMTILES_URL || ''
const THRU_PMTILES_URL = import.meta.env.VITE_THRUHIKES_PMTILES_URL || ''
const TRAILS_AVAILABLE = TRAILS_PMTILES_URL.length > 0 || THRU_PMTILES_URL.length > 0
const SOURCE_LAYER = 'geo'
const TRAILS_SOURCE_LAYER = 'trails'
const THRU_SOURCE_LAYER = 'thruhikes'

export interface AugmentationSpec {
  version: 8
  sources: Record<string, SourceSpecification>
  layers: LayerSpecification[]
  terrain?: { source: string; exaggeration: number }
}

// Sub-selectors group related slice fields into a single memoized bundle.
// Outer `selectAugmentationSpec` depends on bundle references so it only
// re-evaluates when fields that actually feed the spec change — passing raw
// slice refs would bust memo on unrelated fields (e.g. basemap swap
// shouldn't trigger a full spec recompute).
const selectThemeInputs = createSelector(
  [
    (s: RootState) => s.mapStyle.selectedTheme,
    (s: RootState) => s.mapStyle.fillOpacity,
    (s: RootState) => s.mapStyle.selectedUiTheme,
    (s: RootState) => s.mapStyle.uiMode,
  ],
  (selectedTheme, fillOpacity, selectedUiTheme, uiMode) => ({
    selectedTheme, fillOpacity, selectedUiTheme, uiMode,
  }),
)

const selectParksFilterInputs = createSelector(
  [
    (s: RootState) => s.parksFilter.selectedCategory,
    (s: RootState) => s.parksFilter.selectedDesignation,
  ],
  (selectedCategory, selectedDesignation) => ({ selectedCategory, selectedDesignation }),
)

const selectTrailsFilterInputs = createSelector(
  [
    (s: RootState) => s.trailsFilter.visible,
    (s: RootState) => s.trailsFilter.maxLengthKm,
    (s: RootState) => s.trailsFilter.surfaces,
    (s: RootState) => s.trailsFilter.difficulty,
    (s: RootState) => s.trailsFilter.thruHikesOnly,
  ],
  (visible, maxLengthKm, surfaces, difficulty, thruHikesOnly) => ({
    visible, maxLengthKm, surfaces, difficulty, thruHikesOnly,
  }),
)

export const selectAugmentationSpec = createSelector(
  [
    selectThemeInputs,
    selectParksFilterInputs,
    selectTrailsFilterInputs,
    (s: RootState) => s.terrain.terrainExaggeration,
  ],
  (
    { selectedTheme, fillOpacity, selectedUiTheme, uiMode },
    { selectedCategory, selectedDesignation },
    {
      visible: trailsVisible,
      maxLengthKm: trailsMaxLengthKm,
      surfaces: trailsSurfaces,
      difficulty: trailsDifficulty,
      thruHikesOnly: trailsThruOnly,
    },
    terrainExaggeration,
  ): AugmentationSpec => {
    const theme = getUiTheme(selectedUiTheme)
    const palette = getEffectivePalette(theme, uiMode)
    const dataPalette = palette.dataPalette
    const dataTheme = buildThemeOptions(dataPalette)[selectedTheme]

    const conditions: unknown[] = []
    if (selectedCategory !== 'all') conditions.push(['==', ['get', 'DESIG_TYPE'], selectedCategory])
    if (selectedDesignation !== 'all') conditions.push(['==', ['get', 'DESIG'], selectedDesignation])
    const filter = conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : ['all', ...conditions]

    // Build the trails filter expression. Mapbox `filter` takes a single
    // boolean expression; we compose ['all', ...] only if there are
    // multiple constraints, mirroring the parks pattern above.
    const trailConditions: unknown[] = []
    if (trailsMaxLengthKm !== null) {
      trailConditions.push(['<=', ['coalesce', ['get', 'length_km'], 0], trailsMaxLengthKm])
    }
    if (trailsSurfaces.length > 0) {
      trailConditions.push(['in', ['get', 'surface'], ['literal', trailsSurfaces]])
    }
    if (trailsDifficulty !== 'any') {
      trailConditions.push(['==', ['get', 'difficulty'], trailsDifficulty])
    }
    const trailFilter = trailConditions.length === 0
      ? undefined
      : trailConditions.length === 1
        ? trailConditions[0]
        : ['all', ...trailConditions]

    const sources: Record<string, SourceSpecification> = {
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
    }

    const layers: LayerSpecification[] = [
      {
        id: 'parks-fill',
        type: 'fill',
        source: 'national-parks',
        'source-layer': SOURCE_LAYER,
        ...(filter ? { filter } : {}),
        paint: {
          'fill-color': buildColorExpression(dataTheme),
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
          'line-color': buildOutlineColorExpression(dataTheme),
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
    ]

    if (trailsVisible && TRAILS_AVAILABLE) {
      // Only declare the sources when trails are on — saves the PMTiles
      // header fetch on first paint when the user has trails off. We also
      // bail out entirely if no trails URL is configured (TRAILS_AVAILABLE
      // is false) so a deployment without the optional trails archive
      // doesn't hit a 404 storm on every viewport.
      if (TRAILS_PMTILES_URL) {
        sources['trails'] = {
          type: 'vector',
          url: TRAILS_PMTILES_URL,
          promoteId: 'osm_id',
        } as SourceSpecification
      }
      if (THRU_PMTILES_URL) {
        sources['thruhikes'] = {
          type: 'vector',
          url: THRU_PMTILES_URL,
          promoteId: 'osm_id',
        } as SourceSpecification
      }

      const hasTrailsSrc = !!sources['trails']
      const hasThruSrc = !!sources['thruhikes']

      // Selection halo — a wide, blurred glow in the trail's own color
      // that only appears on the selected feature (opacity 0 otherwise).
      // Rendered BEFORE casing so the glow haloes the entire ribbon.
      if (!trailsThruOnly && hasTrailsSrc) {
        layers.push({
          id: 'trails-selected-halo',
          type: 'line',
          source: 'trails',
          'source-layer': TRAILS_SOURCE_LAYER,
          minzoom: 8,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': palette.mapTrail,
            'line-width': [
              'interpolate', ['linear'], ['zoom'],
              8, 8, 11, 14, 14, 22, 17, 34,
            ],
            'line-blur': 6,
            'line-opacity': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 0.55,
              0,
            ],
          },
        } as LayerSpecification)
      }

      // Casing (wider contrasting underlay) — gives the colored line a
      // "ribbon" look against any basemap. Casing color is a deep
      // saturated shade of the trail hue so it reads as an outline rim
      // even on a near-black or pale basemap (where `mapBg` would make
      // the casing invisible). Selected casings get a noticeably thicker
      // stroke to reinforce the selection halo above.
      if (!trailsThruOnly && hasTrailsSrc) {
        layers.push({
          id: 'trails-casing',
          type: 'line',
          source: 'trails',
          'source-layer': TRAILS_SOURCE_LAYER,
          minzoom: 8,
          ...(trailFilter ? { filter: trailFilter } : {}),
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': palette.mapTrailCasing,
            'line-width': [
              'interpolate', ['linear'], ['zoom'],
              8, ['case',
                ['boolean', ['feature-state', 'selected'], false], 3.5,
                ['boolean', ['feature-state', 'hover'], false], 2.2,
                1.2,
              ],
              11, ['case',
                ['boolean', ['feature-state', 'selected'], false], 7,
                ['boolean', ['feature-state', 'hover'], false], 5,
                3.5,
              ],
              14, ['case',
                ['boolean', ['feature-state', 'selected'], false], 11,
                ['boolean', ['feature-state', 'hover'], false], 8.5,
                6.5,
              ],
              17, ['case',
                ['boolean', ['feature-state', 'selected'], false], 18,
                ['boolean', ['feature-state', 'hover'], false], 14,
                11,
              ],
            ],
            'line-opacity': 0.9,
          },
        } as LayerSpecification)

        layers.push({
          id: 'trails-primary',
          type: 'line',
          source: 'trails',
          'source-layer': TRAILS_SOURCE_LAYER,
          minzoom: 8,
          ...(trailFilter ? {
            filter: ['all',
              trailFilter as ExpressionSpecification,
              ['!=', ['coalesce', ['get', 'informal'], 'no'], 'yes'],
            ] as ExpressionSpecification,
          } : {
            filter: ['!=', ['coalesce', ['get', 'informal'], 'no'], 'yes'] as ExpressionSpecification,
          }),
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            // Selected → switch to the warm accent hex for a hue shift
            // that makes the selection unmistakable even at low zoom.
            'line-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], palette.accentWarmHex,
              palette.mapTrail,
            ],
            'line-width': [
              'interpolate', ['linear'], ['zoom'],
              8, ['case',
                ['boolean', ['feature-state', 'selected'], false], 2.5,
                ['boolean', ['feature-state', 'hover'], false], 1.6,
                0.8,
              ],
              11, ['case',
                ['boolean', ['feature-state', 'selected'], false], 5,
                ['boolean', ['feature-state', 'hover'], false], 3.2,
                1.5,
              ],
              14, ['case',
                ['boolean', ['feature-state', 'selected'], false], 8,
                ['boolean', ['feature-state', 'hover'], false], 5.5,
                2.5,
              ],
              17, ['case',
                ['boolean', ['feature-state', 'selected'], false], 13,
                ['boolean', ['feature-state', 'hover'], false], 9,
                4,
              ],
            ],
            'line-opacity': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 1,
              0.95,
            ],
          },
        } as LayerSpecification)

        // Dashed variant for informal / unmaintained ways. Same color as
        // the primary line so the dash itself communicates "less reliable".
        layers.push({
          id: 'trails-dashed',
          type: 'line',
          source: 'trails',
          'source-layer': TRAILS_SOURCE_LAYER,
          minzoom: 8,
          filter: ['==', ['coalesce', ['get', 'informal'], 'no'], 'yes'] as ExpressionSpecification,
          layout: {
            'line-cap': 'butt',
            'line-join': 'round',
          },
          paint: {
            'line-color': palette.mapTrail,
            'line-width': 1.5,
            'line-dasharray': [2, 2],
            'line-opacity': 0.85,
          },
        } as LayerSpecification)
      }

      // Thru-hikes — separate tiny PMTiles, visible from world zoom so the
      // famous routes (PCT, AT, GR…) read at z2 and don't disappear when
      // you zoom out of the local trails layer. Gets the same selection
      // halo + hue shift treatment as local trails so clicks on a thru
      // route get the same visual confirmation.
      if (hasThruSrc) {
        layers.push({
          id: 'trails-thru-halo',
          type: 'line',
          source: 'thruhikes',
          'source-layer': THRU_SOURCE_LAYER,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': palette.mapTrailThru,
            'line-width': [
              'interpolate', ['linear'], ['zoom'],
              0, 6, 6, 10, 10, 16, 14, 26,
            ],
            'line-blur': 6,
            'line-opacity': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 0.55,
              0,
            ],
          },
        } as LayerSpecification)

        layers.push({
          id: 'trails-thru',
          type: 'line',
          source: 'thruhikes',
          'source-layer': THRU_SOURCE_LAYER,
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], palette.accentWarmHex,
              palette.mapTrailThru,
            ],
            'line-width': [
              'interpolate', ['linear'], ['zoom'],
              0, ['case',
                ['boolean', ['feature-state', 'selected'], false], 2.2,
                ['boolean', ['feature-state', 'hover'], false], 1.6,
                1,
              ],
              6, ['case',
                ['boolean', ['feature-state', 'selected'], false], 3.6,
                ['boolean', ['feature-state', 'hover'], false], 2.6,
                1.8,
              ],
              10, ['case',
                ['boolean', ['feature-state', 'selected'], false], 5,
                ['boolean', ['feature-state', 'hover'], false], 3.6,
                2.5,
              ],
              14, ['case',
                ['boolean', ['feature-state', 'selected'], false], 7,
                ['boolean', ['feature-state', 'hover'], false], 5,
                3.5,
              ],
            ],
            'line-opacity': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 1,
              0.95,
            ],
          },
        } as LayerSpecification)
      }

      // Trail labels — line-placed names, halo from `mapBg` for legibility.
      // Pitch-faded so the names don't crowd the satellite during fly-along.
      if (!trailsThruOnly && hasTrailsSrc) {
        layers.push({
          id: 'trails-labels',
          type: 'symbol',
          source: 'trails',
          'source-layer': TRAILS_SOURCE_LAYER,
          minzoom: 8,
          filter: ['has', 'name'] as ExpressionSpecification,
          layout: {
            'symbol-placement': 'line',
            'text-field': ['get', 'name'],
            'text-font': ['Geologica Light', 'Arial Unicode MS Regular'],
            'text-size': 11,
            'text-letter-spacing': 0.05,
            'text-pitch-alignment': 'viewport',
          },
          paint: {
            'text-color': palette.mapTrail,
            'text-halo-color': palette.mapTrailHalo,
            'text-halo-width': 1.4,
            'text-halo-blur': 0.4,
            'text-opacity': 1,
          },
        } as LayerSpecification)
      }
    }

    return {
      version: 8,
      sources,
      layers,
      ...(terrainExaggeration > 0 ? { terrain: { source: 'mapbox-dem', exaggeration: terrainExaggeration } } : {}),
    }
  }
)
