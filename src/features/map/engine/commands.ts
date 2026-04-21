import type { EasingOptions, FitBoundsOptions, LngLatBoundsLike, AnyLayer } from 'mapbox-gl'
import type { AugmentationSpec } from './styleAugmentation'

export type MapCommand =
  // ── Active (Phase 2) ──────────────────────────────────────────────────────
  | { type: 'STYLE_RECONCILE'; spec: AugmentationSpec }
  | { type: 'BASEMAP_CHANGE';  basemapId: string }
  | { type: 'UI_THEME_CHANGE'; themeId: string }

  // ── Camera (Phase 3) ──────────────────────────────────────────────────────
  | { type: 'FLY_TO';     options: EasingOptions }
  | { type: 'FIT_BOUNDS'; bounds: LngLatBoundsLike; options?: FitBoundsOptions }
  | { type: 'EASE_TO';    options: EasingOptions }

  // ── Parks ─────────────────────────────────────────────────────────────────
  | { type: 'PARK_SELECT';        siteId: string | number }
  | { type: 'PARK_DESELECT' }
  | { type: 'PARK_TOUR_START';    siteId: string | number }
  | { type: 'PARK_TOUR_STOP';     restoreCamera?: boolean }
  | { type: 'RESOLVE_PARK_BY_ID'; id: string }

  // ── Trails ────────────────────────────────────────────────────────────────
  | { type: 'TRAIL_HOVER';     trailId: string | number | null }
  | { type: 'TRAIL_SELECT';    trailId: string | number | null }
  | { type: 'START_FLY_ALONG'; trailId: string | number }
  | { type: 'STOP_FLY_ALONG';  restoreCamera?: boolean }

  // ── Data / layers (future) ────────────────────────────────────────────────
  | { type: 'UPDATE_GEOJSON';       sourceId: string; data: unknown }
  | { type: 'ADD_LAYER';            spec: AnyLayer; before?: string }
  | { type: 'REMOVE_LAYER';         layerId: string }
  | { type: 'SET_LAYER_VISIBILITY'; layerId: string; visible: boolean }
