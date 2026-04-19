// Pre-fetches Mapbox satellite raster tiles covering a bbox, stitches them
// into a single canvas, and returns a blob URL plus the snapped tile-grid
// corner coordinates suitable for a Mapbox `image` source.
//
// Why not just use a `raster` source with `bounds`?
//   1. Tile LOD swaps cause a brief flicker/blur as the user zooms.
//   2. Tile pixels bleed past `bounds` (Mapbox only restricts which tiles
//      get *requested*, not how each rendered tile clips), so the inverse
//      mask polygon needed a generous pad to hide the leak.
//   3. The mask-vs-satellite alignment can shimmer at tile boundaries.
//
// A single image source side-steps all three: one texture, mask hugs the
// snapped-tile extent exactly, no LOD swap inside the selection bubble.
//
// Trade-off: resolution is fixed at the chosen zoom. We pick the *highest*
// zoom whose covering tile grid fits inside MAX_PX (default 4096) so small
// parks get crisp z14 imagery while continent-scale parks gracefully fall
// back to z10. Past native resolution Mapbox upsamples — fine for a
// fitBounds-bounded view, blurry only if the user zooms in far past the
// initial framing.

const MAPBOX_SAT_URL = 'https://api.mapbox.com/v4/mapbox.satellite'
const TILE_SIZE = 256
const MAX_PX = 4096        // canvas dimension cap (per axis)
const MIN_ZOOM = 6
const MAX_ZOOM = 15

export interface StitchedTiles {
  imageUrl: string         // blob: URL — caller owns lifetime, must revoke
  // [nw, ne, se, sw] — Mapbox image source `coordinates` order
  coordinates: [
    [number, number], [number, number], [number, number], [number, number],
  ]
  // Snapped tile-grid extent (lon/lat). Use this for the inverse-mask
  // polygon so it hugs the satellite footprint exactly, no padding needed.
  extent: { west: number; south: number; east: number; north: number }
  zoom: number
  tileCount: number
}

interface TileRange {
  z: number
  xMin: number; xMax: number
  yMin: number; yMax: number
}

// Slippy-map tile math (Web Mercator).
function lonToTileX(lon: number, z: number): number {
  return ((lon + 180) / 360) * Math.pow(2, z)
}
function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z)
}
function tileXToLon(x: number, z: number): number {
  return (x / Math.pow(2, z)) * 360 - 180
}
function tileYToLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z)
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

function tileRangeAtZoom(
  bounds: [[number, number], [number, number]],
  z: number,
): TileRange {
  const [[w, s], [e, n]] = bounds
  // Clamp lat to mercator-renderable range to avoid Infinity from latToTileY.
  const sClamped = Math.max(s, -85.0511)
  const nClamped = Math.min(n, 85.0511)
  return {
    z,
    xMin: Math.floor(lonToTileX(w, z)),
    xMax: Math.floor(lonToTileX(e, z)),
    // latToTileY decreases as lat increases — north becomes yMin, south yMax.
    yMin: Math.floor(latToTileY(nClamped, z)),
    yMax: Math.floor(latToTileY(sClamped, z)),
  }
}

// Pick the highest zoom whose tile-grid pixel dimensions both fit MAX_PX.
function pickTileRange(
  bounds: [[number, number], [number, number]],
  maxPx = MAX_PX,
): TileRange {
  for (let z = MAX_ZOOM; z >= MIN_ZOOM; z--) {
    const r = tileRangeAtZoom(bounds, z)
    const w = (r.xMax - r.xMin + 1) * TILE_SIZE
    const h = (r.yMax - r.yMin + 1) * TILE_SIZE
    if (w <= maxPx && h <= maxPx) return r
  }
  return tileRangeAtZoom(bounds, MIN_ZOOM)
}

// Project a (lon, lat) point to canvas pixel coordinates within the snapped
// tile-grid covered by `range`. Both axes go through tile-space first so
// the mapping stays mercator-correct even at high latitudes.
function lonLatToCanvasXY(
  lon: number,
  lat: number,
  range: TileRange,
): [number, number] {
  const tx = lonToTileX(lon, range.z)
  const ty = latToTileY(lat, range.z)
  return [(tx - range.xMin) * TILE_SIZE, (ty - range.yMin) * TILE_SIZE]
}

// Build a single Path2D containing every ring of every polygon in the
// feature. Combined with `ctx.clip(path, 'nonzero')` this composes
// MultiPolygons and holes correctly per the GeoJSON winding spec
// (outer rings CCW → +1, holes CW → -1).
//
// Why nonzero and not evenodd:
//   Tippecanoe slices polygons at vector-tile boundaries, so a single park
//   that crosses a tile edge comes back as a MultiPolygon of adjacent
//   pieces sharing that boundary. With evenodd a horizontal scanline
//   crossing two adjacent polygons toggles in/out 4 times and leaves the
//   second polygon's interior "outside" — manifesting as a thin
//   tile-boundary-shaped strip of un-clipped (transparent) canvas inside
//   what should be a fully-filled silhouette. nonzero counts winding so
//   each disjoint CCW ring fills independently.
//
// To make nonzero behave correctly we explicitly re-wind each ring so
// outer rings are CCW and inner rings (holes) are CW, regardless of how
// the source data is wound. tippecanoe / vector-tile decoding does not
// guarantee GeoJSON-spec winding.
function ringSignedArea(ring: number[][]): number {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1])
  }
  return a / 2
}

function geometryToPath(
  feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
  range: TileRange,
): Path2D {
  const path = new Path2D()
  const polys: number[][][][] = feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates

  for (const poly of polys) {
    for (let r = 0; r < poly.length; r++) {
      const ring = poly[r]
      if (ring.length === 0) continue
      const isOuter = r === 0
      // GeoJSON spec: outer ring CCW (positive area in screen-y-down
      // coordinates is CW; but lon/lat is y-up, so positive signed area =
      // CCW). We want outer rings positive-area in lon/lat space.
      const wantPositive = isOuter
      const area = ringSignedArea(ring)
      const reverse = wantPositive ? area < 0 : area > 0

      const indices = reverse
        ? Array.from({ length: ring.length }, (_, i) => ring.length - 1 - i)
        : Array.from({ length: ring.length }, (_, i) => i)

      const [x0, y0] = lonLatToCanvasXY(ring[indices[0]][0], ring[indices[0]][1], range)
      path.moveTo(x0, y0)
      for (let i = 1; i < indices.length; i++) {
        const [x, y] = lonLatToCanvasXY(ring[indices[i]][0], ring[indices[i]][1], range)
        path.lineTo(x, y)
      }
      path.closePath()
    }
  }
  return path
}

function loadImage(url: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const onAbort = (): void => {
      img.src = ''
      reject(new DOMException('Aborted', 'AbortError'))
    }
    if (signal.aborted) return onAbort()
    signal.addEventListener('abort', onAbort, { once: true })
    img.onload = () => {
      signal.removeEventListener('abort', onAbort)
      resolve(img)
    }
    img.onerror = () => {
      signal.removeEventListener('abort', onAbort)
      reject(new Error(`Tile load failed: ${url}`))
    }
    img.src = url
  })
}

export async function stitchSatelliteTiles(
  bounds: [[number, number], [number, number]],
  geometry: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
  token: string,
  signal: AbortSignal,
  maxPx = MAX_PX,
): Promise<StitchedTiles> {
  if (!token) throw new Error('Mapbox access token required')

  const range = pickTileRange(bounds, maxPx)
  const { z, xMin, xMax, yMin, yMax } = range
  const cols = xMax - xMin + 1
  const rows = yMax - yMin + 1
  const tileCount = cols * rows

  const canvas = document.createElement('canvas')
  canvas.width = cols * TILE_SIZE
  canvas.height = rows * TILE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')

  // Build a Path2D from the park polygon in canvas pixel space, then use
  // it as a clip region BEFORE drawing tiles. Pixels falling outside the
  // park silhouette are simply never written, so the resulting blob has
  // transparent edges that let the basemap show through naturally — no
  // separate mask layer required on the Mapbox side.
  //
  // Tile-space y is mercator-linear at this zoom level (the canvas IS the
  // tile grid), so lat → y goes through `latToTileY` to stay correct
  // even at high latitudes / large parks.
  const polyPath = geometryToPath(geometry, range)
  ctx.save()
  // nonzero (the canvas default) — see geometryToPath for why evenodd
  // breaks on tippecanoe-sliced MultiPolygons. geometryToPath rewinds
  // outer rings CCW and holes CW so winding numbers compose correctly.
  ctx.clip(polyPath, 'nonzero')

  // Fetch all tiles in parallel via <img> (browser handles HTTP cache + CORS
  // for *.mapbox.com automatically). Drawing happens as each one resolves.
  const jobs: Promise<void>[] = []
  for (let y = yMin; y <= yMax; y++) {
    for (let x = xMin; x <= xMax; x++) {
      const url = `${MAPBOX_SAT_URL}/${z}/${x}/${y}.jpg?access_token=${token}`
      const dx = (x - xMin) * TILE_SIZE
      const dy = (y - yMin) * TILE_SIZE
      jobs.push(loadImage(url, signal).then((img) => {
        if (signal.aborted) return
        ctx.drawImage(img, dx, dy)
      }))
    }
  }

  await Promise.all(jobs)
  ctx.restore()
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

  // PNG (not JPEG) — JPEG can't carry the alpha channel that the polygon
  // clip just produced, so the transparent areas would come back black.
  const blob = await new Promise<Blob | null>((res) => {
    canvas.toBlob(res, 'image/png')
  })
  if (!blob) throw new Error('canvas toBlob returned null')

  const imageUrl = URL.createObjectURL(blob)

  const west  = tileXToLon(xMin,     z)
  const east  = tileXToLon(xMax + 1, z)
  const north = tileYToLat(yMin,     z)
  const south = tileYToLat(yMax + 1, z)

  return {
    imageUrl,
    coordinates: [
      [west, north],  // nw
      [east, north],  // ne
      [east, south],  // se
      [west, south],  // sw
    ],
    extent: { west, south, east, north },
    zoom: z,
    tileCount,
  }
}
