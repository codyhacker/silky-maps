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
