// Returns fitBounds padding that keeps the selected feature in the visible
// portion of the map above the bottom-sheet panel on mobile.
// On desktop returns a flat number so callers can pass it directly.
export function mobileFitPadding(opts: { top?: number; right?: number } = {}): number | { top: number; bottom: number; left: number; right: number } {
  if (typeof window === 'undefined' || window.innerWidth > 768) {
    return opts.right ?? 60
  }
  return {
    top: opts.top ?? 60,
    // Panel opens at 40vh; leave a bit of breathing room above it.
    bottom: Math.round(window.innerHeight * 0.46),
    left: 24,
    right: 24,
  }
}

export interface CameraSnapshot {
  center: [number, number]
  zoom: number
  bearing: number
  pitch: number
}

export function getBoundsFromGeometry(
  geometry: GeoJSON.Geometry | null | undefined,
): [[number, number], [number, number]] | null {
  if (!geometry) return null

  let minLng = Infinity, maxLng = -Infinity
  let minLat = Infinity, maxLat = -Infinity

  function visit(coords: number[]) {
    if (coords[0] < minLng) minLng = coords[0]
    if (coords[0] > maxLng) maxLng = coords[0]
    if (coords[1] < minLat) minLat = coords[1]
    if (coords[1] > maxLat) maxLat = coords[1]
  }

  if (geometry.type === 'Point') {
    visit(geometry.coordinates)
  } else if (geometry.type === 'MultiPoint' || geometry.type === 'LineString') {
    geometry.coordinates.forEach(visit)
  } else if (geometry.type === 'Polygon') {
    geometry.coordinates[0].forEach(visit)
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach(poly => poly[0].forEach(visit))
  } else if (geometry.type === 'MultiLineString') {
    geometry.coordinates.forEach(line => line.forEach(visit))
  }

  if (!isFinite(minLng)) return null
  return [[minLng, minLat], [maxLng, maxLat]]
}

// Forward bearing in degrees (0=N, 90=E) from a→b on a sphere.
// Used by the fly-along loop to keep the camera pointed at the next sample.
export function computeBearingDeg(a: [number, number], b: [number, number]): number {
  const toRad = (d: number): number => (d * Math.PI) / 180
  const toDeg = (r: number): number => (r * 180) / Math.PI
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const dLon = toRad(b[0] - a[0])
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}
