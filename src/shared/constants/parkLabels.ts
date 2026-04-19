// ─── IUCN Category ───────────────────────────────────────────────────────────

export const IUCN_LABELS: Record<string, string> = {
  'Ia':              'Strict Nature Reserve',
  'Ib':              'Wilderness Area',
  'II':              'National Park',
  'III':             'Natural Monument',
  'IV':              'Habitat Management Area',
  'V':               'Protected Landscape',
  'VI':              'Managed Resource Reserve',
  'Not Reported':    'Category not reported',
  'Not Applicable':  'Category not applicable',
  'Not Assigned':    'Category not assigned',
}

export const IUCN_DESCRIPTIONS: Record<string, string> = {
  'Ia': 'Strictly protected — no human use',
  'Ib': 'Large unmodified wilderness',
  'II': 'Large natural area, managed for ecosystem and recreation',
  'III': 'Specific natural landmark or feature',
  'IV': 'Managed specifically for species or habitats',
  'V': 'Natural landscape shaped by people over time',
  'VI': 'Balances conservation with sustainable resource use',
}

// ─── Governance ──────────────────────────────────────────────────────────────

export const GOV_LABELS: Record<string, string> = {
  'Federal or national ministry or agency': 'Federal government',
  'Sub-national ministry or agency':        'State / regional government',
  'Government-delegated management':        'Delegated government management',
  'Collaborative governance':               'Collaborative governance',
  'Joint governance':                       'Joint governance',
  'Individual landowners':                  'Private landowner',
  'Non-profit organisations':              'Non-profit organisation',
  'For-profit organisations':              'Private / commercial',
  'Indigenous peoples':                     'Indigenous peoples',
  'Local communities':                      'Local community',
  'Not Reported':                           'Governance not reported',
}

// ─── Countries ───────────────────────────────────────────────────────────────

export interface CountryInfo {
  name: string
  flag: string
}

export const COUNTRY_INFO: Record<string, CountryInfo> = {
  AFG: { name: 'Afghanistan',                   flag: '🇦🇫' },
  AGO: { name: 'Angola',                        flag: '🇦🇴' },
  ALB: { name: 'Albania',                       flag: '🇦🇱' },
  AND: { name: 'Andorra',                       flag: '🇦🇩' },
  ARE: { name: 'United Arab Emirates',          flag: '🇦🇪' },
  ARG: { name: 'Argentina',                     flag: '🇦🇷' },
  ARM: { name: 'Armenia',                       flag: '🇦🇲' },
  ATG: { name: 'Antigua and Barbuda',           flag: '🇦🇬' },
  AUS: { name: 'Australia',                     flag: '🇦🇺' },
  AUT: { name: 'Austria',                       flag: '🇦🇹' },
  AZE: { name: 'Azerbaijan',                    flag: '🇦🇿' },
  BDI: { name: 'Burundi',                       flag: '🇧🇮' },
  BEL: { name: 'Belgium',                       flag: '🇧🇪' },
  BEN: { name: 'Benin',                         flag: '🇧🇯' },
  BFA: { name: 'Burkina Faso',                  flag: '🇧🇫' },
  BGD: { name: 'Bangladesh',                    flag: '🇧🇩' },
  BGR: { name: 'Bulgaria',                      flag: '🇧🇬' },
  BHR: { name: 'Bahrain',                       flag: '🇧🇭' },
  BHS: { name: 'Bahamas',                       flag: '🇧🇸' },
  BIH: { name: 'Bosnia and Herzegovina',        flag: '🇧🇦' },
  BLR: { name: 'Belarus',                       flag: '🇧🇾' },
  BLZ: { name: 'Belize',                        flag: '🇧🇿' },
  BOL: { name: 'Bolivia',                       flag: '🇧🇴' },
  BRA: { name: 'Brazil',                        flag: '🇧🇷' },
  BRB: { name: 'Barbados',                      flag: '🇧🇧' },
  BRN: { name: 'Brunei',                        flag: '🇧🇳' },
  BTN: { name: 'Bhutan',                        flag: '🇧🇹' },
  BWA: { name: 'Botswana',                      flag: '🇧🇼' },
  CAF: { name: 'Central African Republic',      flag: '🇨🇫' },
  CAN: { name: 'Canada',                        flag: '🇨🇦' },
  CHE: { name: 'Switzerland',                   flag: '🇨🇭' },
  CHL: { name: 'Chile',                         flag: '🇨🇱' },
  CHN: { name: 'China',                         flag: '🇨🇳' },
  CIV: { name: "Côte d'Ivoire",                 flag: '🇨🇮' },
  CMR: { name: 'Cameroon',                      flag: '🇨🇲' },
  COD: { name: 'DR Congo',                      flag: '🇨🇩' },
  COG: { name: 'Republic of the Congo',         flag: '🇨🇬' },
  COL: { name: 'Colombia',                      flag: '🇨🇴' },
  COM: { name: 'Comoros',                       flag: '🇰🇲' },
  CPV: { name: 'Cape Verde',                    flag: '🇨🇻' },
  CRI: { name: 'Costa Rica',                    flag: '🇨🇷' },
  CUB: { name: 'Cuba',                          flag: '🇨🇺' },
  CYP: { name: 'Cyprus',                        flag: '🇨🇾' },
  CZE: { name: 'Czech Republic',                flag: '🇨🇿' },
  DEU: { name: 'Germany',                       flag: '🇩🇪' },
  DJI: { name: 'Djibouti',                      flag: '🇩🇯' },
  DMA: { name: 'Dominica',                      flag: '🇩🇲' },
  DNK: { name: 'Denmark',                       flag: '🇩🇰' },
  DOM: { name: 'Dominican Republic',            flag: '🇩🇴' },
  DZA: { name: 'Algeria',                       flag: '🇩🇿' },
  ECU: { name: 'Ecuador',                       flag: '🇪🇨' },
  EGY: { name: 'Egypt',                         flag: '🇪🇬' },
  ERI: { name: 'Eritrea',                       flag: '🇪🇷' },
  ESP: { name: 'Spain',                         flag: '🇪🇸' },
  EST: { name: 'Estonia',                       flag: '🇪🇪' },
  ETH: { name: 'Ethiopia',                      flag: '🇪🇹' },
  FIN: { name: 'Finland',                       flag: '🇫🇮' },
  FJI: { name: 'Fiji',                          flag: '🇫🇯' },
  FRA: { name: 'France',                        flag: '🇫🇷' },
  FSM: { name: 'Micronesia',                    flag: '🇫🇲' },
  GAB: { name: 'Gabon',                         flag: '🇬🇦' },
  GBR: { name: 'United Kingdom',                flag: '🇬🇧' },
  GEO: { name: 'Georgia',                       flag: '🇬🇪' },
  GHA: { name: 'Ghana',                         flag: '🇬🇭' },
  GIN: { name: 'Guinea',                        flag: '🇬🇳' },
  GMB: { name: 'Gambia',                        flag: '🇬🇲' },
  GNB: { name: 'Guinea-Bissau',                 flag: '🇬🇼' },
  GNQ: { name: 'Equatorial Guinea',             flag: '🇬🇶' },
  GRC: { name: 'Greece',                        flag: '🇬🇷' },
  GRD: { name: 'Grenada',                       flag: '🇬🇩' },
  GTM: { name: 'Guatemala',                     flag: '🇬🇹' },
  GUY: { name: 'Guyana',                        flag: '🇬🇾' },
  HND: { name: 'Honduras',                      flag: '🇭🇳' },
  HRV: { name: 'Croatia',                       flag: '🇭🇷' },
  HTI: { name: 'Haiti',                         flag: '🇭🇹' },
  HUN: { name: 'Hungary',                       flag: '🇭🇺' },
  IDN: { name: 'Indonesia',                     flag: '🇮🇩' },
  IND: { name: 'India',                         flag: '🇮🇳' },
  IRL: { name: 'Ireland',                       flag: '🇮🇪' },
  IRN: { name: 'Iran',                          flag: '🇮🇷' },
  IRQ: { name: 'Iraq',                          flag: '🇮🇶' },
  ISL: { name: 'Iceland',                       flag: '🇮🇸' },
  ISR: { name: 'Israel',                        flag: '🇮🇱' },
  ITA: { name: 'Italy',                         flag: '🇮🇹' },
  JAM: { name: 'Jamaica',                       flag: '🇯🇲' },
  JOR: { name: 'Jordan',                        flag: '🇯🇴' },
  JPN: { name: 'Japan',                         flag: '🇯🇵' },
  KAZ: { name: 'Kazakhstan',                    flag: '🇰🇿' },
  KEN: { name: 'Kenya',                         flag: '🇰🇪' },
  KGZ: { name: 'Kyrgyzstan',                    flag: '🇰🇬' },
  KHM: { name: 'Cambodia',                      flag: '🇰🇭' },
  KIR: { name: 'Kiribati',                      flag: '🇰🇮' },
  KNA: { name: 'Saint Kitts and Nevis',         flag: '🇰🇳' },
  KOR: { name: 'South Korea',                   flag: '🇰🇷' },
  KWT: { name: 'Kuwait',                        flag: '🇰🇼' },
  LAO: { name: 'Laos',                          flag: '🇱🇦' },
  LBN: { name: 'Lebanon',                       flag: '🇱🇧' },
  LBR: { name: 'Liberia',                       flag: '🇱🇷' },
  LBY: { name: 'Libya',                         flag: '🇱🇾' },
  LCA: { name: 'Saint Lucia',                   flag: '🇱🇨' },
  LIE: { name: 'Liechtenstein',                 flag: '🇱🇮' },
  LKA: { name: 'Sri Lanka',                     flag: '🇱🇰' },
  LSO: { name: 'Lesotho',                       flag: '🇱🇸' },
  LTU: { name: 'Lithuania',                     flag: '🇱🇹' },
  LUX: { name: 'Luxembourg',                    flag: '🇱🇺' },
  LVA: { name: 'Latvia',                        flag: '🇱🇻' },
  MAR: { name: 'Morocco',                       flag: '🇲🇦' },
  MCO: { name: 'Monaco',                        flag: '🇲🇨' },
  MDA: { name: 'Moldova',                       flag: '🇲🇩' },
  MDG: { name: 'Madagascar',                    flag: '🇲🇬' },
  MDV: { name: 'Maldives',                      flag: '🇲🇻' },
  MEX: { name: 'Mexico',                        flag: '🇲🇽' },
  MHL: { name: 'Marshall Islands',              flag: '🇲🇭' },
  MKD: { name: 'North Macedonia',               flag: '🇲🇰' },
  MLI: { name: 'Mali',                          flag: '🇲🇱' },
  MLT: { name: 'Malta',                         flag: '🇲🇹' },
  MMR: { name: 'Myanmar',                       flag: '🇲🇲' },
  MNG: { name: 'Mongolia',                      flag: '🇲🇳' },
  MOZ: { name: 'Mozambique',                    flag: '🇲🇿' },
  MRT: { name: 'Mauritania',                    flag: '🇲🇷' },
  MUS: { name: 'Mauritius',                     flag: '🇲🇺' },
  MWI: { name: 'Malawi',                        flag: '🇲🇼' },
  MYS: { name: 'Malaysia',                      flag: '🇲🇾' },
  NAM: { name: 'Namibia',                       flag: '🇳🇦' },
  NER: { name: 'Niger',                         flag: '🇳🇪' },
  NGA: { name: 'Nigeria',                       flag: '🇳🇬' },
  NIC: { name: 'Nicaragua',                     flag: '🇳🇮' },
  NLD: { name: 'Netherlands',                   flag: '🇳🇱' },
  NOR: { name: 'Norway',                        flag: '🇳🇴' },
  NPL: { name: 'Nepal',                         flag: '🇳🇵' },
  NRU: { name: 'Nauru',                         flag: '🇳🇷' },
  NZL: { name: 'New Zealand',                   flag: '🇳🇿' },
  OMN: { name: 'Oman',                          flag: '🇴🇲' },
  PAK: { name: 'Pakistan',                      flag: '🇵🇰' },
  PAN: { name: 'Panama',                        flag: '🇵🇦' },
  PER: { name: 'Peru',                          flag: '🇵🇪' },
  PHL: { name: 'Philippines',                   flag: '🇵🇭' },
  PLW: { name: 'Palau',                         flag: '🇵🇼' },
  PNG: { name: 'Papua New Guinea',              flag: '🇵🇬' },
  POL: { name: 'Poland',                        flag: '🇵🇱' },
  PRK: { name: 'North Korea',                   flag: '🇰🇵' },
  PRT: { name: 'Portugal',                      flag: '🇵🇹' },
  PRY: { name: 'Paraguay',                      flag: '🇵🇾' },
  QAT: { name: 'Qatar',                         flag: '🇶🇦' },
  ROU: { name: 'Romania',                       flag: '🇷🇴' },
  RUS: { name: 'Russia',                        flag: '🇷🇺' },
  RWA: { name: 'Rwanda',                        flag: '🇷🇼' },
  SAU: { name: 'Saudi Arabia',                  flag: '🇸🇦' },
  SDN: { name: 'Sudan',                         flag: '🇸🇩' },
  SEN: { name: 'Senegal',                       flag: '🇸🇳' },
  SGP: { name: 'Singapore',                     flag: '🇸🇬' },
  SLB: { name: 'Solomon Islands',               flag: '🇸🇧' },
  SLE: { name: 'Sierra Leone',                  flag: '🇸🇱' },
  SLV: { name: 'El Salvador',                   flag: '🇸🇻' },
  SMR: { name: 'San Marino',                    flag: '🇸🇲' },
  SOM: { name: 'Somalia',                       flag: '🇸🇴' },
  SRB: { name: 'Serbia',                        flag: '🇷🇸' },
  SSD: { name: 'South Sudan',                   flag: '🇸🇸' },
  STP: { name: 'São Tomé and Príncipe',         flag: '🇸🇹' },
  SUR: { name: 'Suriname',                      flag: '🇸🇷' },
  SVK: { name: 'Slovakia',                      flag: '🇸🇰' },
  SVN: { name: 'Slovenia',                      flag: '🇸🇮' },
  SWE: { name: 'Sweden',                        flag: '🇸🇪' },
  SWZ: { name: 'Eswatini',                      flag: '🇸🇿' },
  SYC: { name: 'Seychelles',                    flag: '🇸🇨' },
  SYR: { name: 'Syria',                         flag: '🇸🇾' },
  TCD: { name: 'Chad',                          flag: '🇹🇩' },
  TGO: { name: 'Togo',                          flag: '🇹🇬' },
  THA: { name: 'Thailand',                      flag: '🇹🇭' },
  TJK: { name: 'Tajikistan',                    flag: '🇹🇯' },
  TKM: { name: 'Turkmenistan',                  flag: '🇹🇲' },
  TLS: { name: 'Timor-Leste',                   flag: '🇹🇱' },
  TON: { name: 'Tonga',                         flag: '🇹🇴' },
  TTO: { name: 'Trinidad and Tobago',           flag: '🇹🇹' },
  TUN: { name: 'Tunisia',                       flag: '🇹🇳' },
  TUR: { name: 'Turkey',                        flag: '🇹🇷' },
  TUV: { name: 'Tuvalu',                        flag: '🇹🇻' },
  TZA: { name: 'Tanzania',                      flag: '🇹🇿' },
  UGA: { name: 'Uganda',                        flag: '🇺🇬' },
  UKR: { name: 'Ukraine',                       flag: '🇺🇦' },
  URY: { name: 'Uruguay',                       flag: '🇺🇾' },
  USA: { name: 'United States',                 flag: '🇺🇸' },
  UZB: { name: 'Uzbekistan',                    flag: '🇺🇿' },
  VCT: { name: 'Saint Vincent and the Grenadines', flag: '🇻🇨' },
  VEN: { name: 'Venezuela',                     flag: '🇻🇪' },
  VNM: { name: 'Vietnam',                       flag: '🇻🇳' },
  VUT: { name: 'Vanuatu',                       flag: '🇻🇺' },
  WSM: { name: 'Samoa',                         flag: '🇼🇸' },
  YEM: { name: 'Yemen',                         flag: '🇾🇪' },
  ZAF: { name: 'South Africa',                  flag: '🇿🇦' },
  ZMB: { name: 'Zambia',                        flag: '🇿🇲' },
  ZWE: { name: 'Zimbabwe',                      flag: '🇿🇼' },
}

export function getCountry(iso3: string | undefined): CountryInfo {
  if (!iso3) return { name: 'Unknown', flag: '🌍' }
  return COUNTRY_INFO[iso3.toUpperCase()] ?? { name: iso3, flag: '🌍' }
}

// ─── Area formatting ─────────────────────────────────────────────────────────

// Reference sizes (km²)
const MANHATTAN  = 59
const SINGAPORE  = 730
const SWITZERLAND = 41_285
const GERMANY    = 357_114
const TEXAS      = 695_662

export function formatArea(km2: number): { display: string; comparison: string } {
  const n = Number(km2)
  if (isNaN(n) || n <= 0) return { display: '—', comparison: '' }

  const display = n >= 1
    ? `${Math.round(n).toLocaleString()} km²`
    : `${n.toFixed(2)} km²`

  let comparison = ''
  if (n >= TEXAS)        comparison = `≈ ${(n / TEXAS).toFixed(1)}× the size of Texas`
  else if (n >= GERMANY) comparison = `≈ ${(n / GERMANY).toFixed(1)}× the size of Germany`
  else if (n >= SWITZERLAND) comparison = `≈ ${(n / SWITZERLAND).toFixed(1)}× the size of Switzerland`
  else if (n >= SINGAPORE)   comparison = `≈ ${(n / SINGAPORE).toFixed(1)}× the size of Singapore`
  else if (n >= MANHATTAN)   comparison = `≈ ${Math.round(n / MANHATTAN)}× Manhattan`
  else if (n >= 10)          comparison = 'about the size of a small city'

  return { display, comparison }
}

// ─── Year / age ──────────────────────────────────────────────────────────────

export function formatProtectionYear(year: string | number | undefined): string {
  const y = Number(year)
  if (!y || isNaN(y) || y < 1800) return ''
  const age = new Date().getFullYear() - y
  return `Protected since ${y} · ${age} year${age !== 1 ? 's' : ''} ago`
}
