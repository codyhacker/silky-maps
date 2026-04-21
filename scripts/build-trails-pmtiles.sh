#!/usr/bin/env bash
# Build trails.pmtiles + thruhikes.pmtiles from an OSM extract.
#
# Output is written *outside* the repo to ~/Documents/PRJ/2026/spatialData/
# (parallel to wdpa.pmtiles). The repo intentionally never holds binary
# spatial data — it points to a hosted .pmtiles via env vars at runtime.
#
# Pipeline:
#   1. osmium tags-filter        → keep only hiking-trail ways + relations
#   2. osmium export             → flatten to GeoJSON-seq (one Feature per line)
#   3. python spatial join       → tag each trail with `inside_park=SITE_PID`
#                                   (uses shapely + rtree against wdpa_poly.geojson)
#   4. tippecanoe                → vector-tile bake into trails.pmtiles
#   5. tippecanoe (relations)    → tiny thruhikes.pmtiles for global zoom-0 view
#
# Requirements (install once):
#   brew install osmium-tool tippecanoe
#   pip install shapely rtree ijson
#
# Usage:
#   ./scripts/build-trails-pmtiles.sh /path/to/north-america-latest.osm.pbf
#   SKIP_JOIN=1 ./scripts/build-trails-pmtiles.sh
#     (reuses cached intermediates from the previous run — useful when
#      re-tuning only the tippecanoe flags below. Cache lives in
#      $OUT_DIR/.trails-build-cache; `rm -rf` it to force a fresh join.)
#
# NA-wide extract runs ~1–2 h end-to-end on an M-series Mac:
#   osmium filter + export  ~15 min
#   spatial join (Python)   ~20–40 min (wdpa polygons in RAM, streaming trails)
#   tippecanoe (trails)     ~30–60 min (CPU-bound on the simplification pass)
#   tippecanoe (thruhikes)  <1 min

set -euo pipefail

INPUT="${1:-}"
if [[ -z "${INPUT}" && -z "${SKIP_JOIN:-}" ]]; then
  echo "usage: $0 <input.osm.pbf>" >&2
  echo "       SKIP_JOIN=1 $0           # reuse cached intermediates from previous run" >&2
  exit 1
fi

OUT_DIR="${HOME}/Documents/PRJ/2026/spatialData"
WDPA_GEOJSON="${OUT_DIR}/wdpa_poly.geojson"

# Intermediates live in a stable cache directory so `SKIP_JOIN=1` can skip
# the expensive osmium + spatial-join stages on re-tunes of the tippecanoe
# flags. Clear it manually (`rm -rf`) when you're done iterating.
BUILD_CACHE="${OUT_DIR}/.trails-build-cache"
mkdir -p "${OUT_DIR}" "${BUILD_CACHE}"

if [[ ! -f "${WDPA_GEOJSON}" ]]; then
  echo "[!] WDPA polygon GeoJSON not found at ${WDPA_GEOJSON}" >&2
  echo "    The spatial-join step needs it to tag trails with their containing park." >&2
  exit 1
fi

RAW_PBF="${BUILD_CACHE}/trails-raw.osm.pbf"
RAW_GJSEQ="${BUILD_CACHE}/trails-raw.geojsonseq"
TAGGED_GJSEQ="${BUILD_CACHE}/trails-tagged.geojsonseq"
THRU_GJSEQ="${BUILD_CACHE}/thruhikes.geojsonseq"

if [[ -n "${SKIP_JOIN:-}" ]]; then
  if [[ ! -f "${TAGGED_GJSEQ}" || ! -f "${THRU_GJSEQ}" ]]; then
    echo "[!] SKIP_JOIN=1 set but cached intermediates missing at ${BUILD_CACHE}" >&2
    echo "    Run a full bake first (drop the flag)." >&2
    exit 1
  fi
  echo "[skip] reusing cached intermediates in ${BUILD_CACHE}"
else
  if [[ ! -f "${INPUT}" ]]; then
    echo "[!] input PBF not found: ${INPUT}" >&2
    exit 1
  fi

  # ── 1. Filter OSM for hiking-relevant ways + relations ─────────────────────
  echo "[1/5] osmium tags-filter…"
  osmium tags-filter "${INPUT}" \
    w/highway=path,footway,track,bridleway \
    w/sport=hiking \
    r/route=hiking,foot \
    -o "${RAW_PBF}" --overwrite

  # ── 2. Export to GeoJSON-seq (one feature per line — streamable) ───────────
  echo "[2/5] osmium export → geojsonseq…"
  osmium export "${RAW_PBF}" \
    --geometry-types=linestring \
    -f geojsonseq \
    -o "${RAW_GJSEQ}" --overwrite

  # ── 3. Spatial join + noise filter ─────────────────────────────────────────
  # Tags each trail with the SITE_PID of any containing park, derives the
  # runtime-consumed properties, and drops noisy OSM (unnamed short
  # fragments, `highway=track` without hiking metadata). Typically cuts
  # ~40–60% of raw feature count on a continental extract.
  echo "[3/5] spatial join + noise filter…"
  python3 "$(dirname "$0")/_spatial_join_trails.py" \
    --trails "${RAW_GJSEQ}" \
    --parks "${WDPA_GEOJSON}" \
    --out-trails "${TAGGED_GJSEQ}" \
    --out-thru "${THRU_GJSEQ}"
fi

# ── 4. Bake trails.pmtiles ───────────────────────────────────────────────────
# Tuned for Cloudflare R2 10 GB budget:
#   -z13           cap max zoom (~19 m/pixel — plenty for trail viz;
#                    each zoom above this 4× tile count)
#   -B 10          delay trails until z10; the thruhikes layer covers
#                    the global view and individual trails below z10 are
#                    just noise pixels anyway
#   -S 15          simplification tolerance (default 10 — higher = more
#                    aggressive geometry reduction at low zooms)
#   --maximum-tile-bytes=200000
#                  forces tippecanoe to thin features when a tile would
#                    exceed 200 KB (default 500 KB). Primary knob for
#                    controlling final file size.
#   --drop-smallest-as-needed + --coalesce-smallest-as-needed
#                  when a tile is too large, drop/merge the *shortest*
#                    trails first — preserves long-distance routes at
#                    the expense of tiny spurs.
echo "[4/5] tippecanoe → trails.pmtiles…"
tippecanoe \
  -o "${OUT_DIR}/trails.pmtiles" \
  -l trails \
  -z13 -Z10 \
  -B 10 \
  -S 15 \
  --drop-smallest-as-needed \
  --coalesce-smallest-as-needed \
  --maximum-tile-bytes=200000 \
  --force \
  "${TAGGED_GJSEQ}"

# ── 5. Bake thruhikes.pmtiles (tiny, low-zoom global view) ───────────────────
echo "[5/5] tippecanoe → thruhikes.pmtiles…"
tippecanoe \
  -o "${OUT_DIR}/thruhikes.pmtiles" \
  -l thruhikes \
  -z6 \
  --drop-densest-as-needed \
  --force \
  "${THRU_GJSEQ}"

echo
echo "Done."
echo "  trails:     ${OUT_DIR}/trails.pmtiles"
echo "  thruhikes:  ${OUT_DIR}/thruhikes.pmtiles"
echo
echo "Set in your .env:"
echo "  VITE_TRAILS_PMTILES_URL=http://localhost:8080/trails.pmtiles"
echo "  VITE_THRUHIKES_PMTILES_URL=http://localhost:8080/thruhikes.pmtiles"
