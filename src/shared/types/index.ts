export interface HoveredFeatureProperties {
  NAME?: string
  NAME_ENG?: string
  DESIG_TYPE?: string
  IUCN_CAT?: string
  DESIG?: string
  STATUS?: string
  STATUS_YR?: string | number
  GOV_TYPE?: string
  REP_AREA?: string | number
  ISO3?: string
  SITE_PID?: string | number
  [key: string]: unknown
}

export interface ParkSearchResult {
  name: string
  iso3: string
  designation: string
  properties: HoveredFeatureProperties
  bounds: [[number, number], [number, number]] | null
}

// Mirrors the keys baked into trails.pmtiles by `_spatial_join_trails.py`.
// Everything is optional because OSM data is wildly inconsistent — most
// trails carry only `osm_id`, `highway`, `length_km`, and `difficulty`.
export interface TrailProperties {
  osm_id?: string | number
  name?: string
  ref?: string
  highway?: string
  surface?: 'any' | 'paved' | 'gravel' | 'unpaved' | string
  sac_scale?: string
  difficulty?: 'easy' | 'moderate' | 'hard' | string
  informal?: 'yes' | 'no' | string
  length_km?: number
  inside_park?: string | number
  [key: string]: unknown
}
