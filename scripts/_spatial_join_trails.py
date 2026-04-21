#!/usr/bin/env python3
"""Spatial-join hiking trails with WDPA park polygons.

Reads a GeoJSON-seq stream of trail LineStrings, tests each one against a
prebuilt R-tree of park polygons, and writes two outputs:

    --out-trails : every trail, tagged with `inside_park=<SITE_PID>` if any
                   point falls inside a WDPA polygon (else the property is
                   omitted). Also derives `length_km`, `surface`,
                   `difficulty`, and `informal` from raw OSM tags.

    --out-thru   : a tiny secondary stream containing only the OSM
                   route=hiking super-relations (PCT, AT, GR routes, etc).
                   These are surfaced separately so they can render at low
                   zoom on the world view without dragging in 100k local
                   trails.

Parallelism model
-----------------
The trails loop is fan-out parallel — every feature is independent of every
other. We use `multiprocessing` (fork start method) so the parks-geometry
list and ID list are shared with workers via copy-on-write rather than
pickled, which on a continental WDPA would be 1-2 GB of pickle per fork
and dominate startup. Each worker then builds its OWN STRtree from the
shared geometries; sharing a parent-built STRtree across forks is unsafe
because GEOS holds C-handles that can become invalid in the child.

Per-feature work also calls into shapely C code (`shape()`, `query()`,
`contains()`) which releases the GIL, so we'd see *some* benefit from
threading too — but multiprocessing is simpler and avoids the GIL hops
on the json.loads / dict-construction paths that don't release it.
"""
from __future__ import annotations

import argparse
import glob
import json
import multiprocessing as mp
import os
import shutil
import sys
import tempfile
import time
from typing import Iterable, Iterator

try:
    import shapely
    from shapely.geometry import shape, LineString
    from shapely.strtree import STRtree
except ImportError:
    print("error: install shapely first (pip install 'shapely>=2.0')", file=sys.stderr)
    sys.exit(1)

# Shapely 1.x's pure-Python STRtree is ~50× slower than shapely 2's C-backed
# one and returns geometries from .query() rather than indices — our
# compatibility fallback for that case does an O(n) `list.index()` lookup
# per candidate, which collapses to ~1 trail/sec on a continental bake.
# Hard-fail rather than silently shipping a week-long run.
_SHAPELY_VERSION = tuple(int(p) for p in shapely.__version__.split(".")[:2])
if _SHAPELY_VERSION < (2, 0):
    print(f"error: shapely {shapely.__version__} detected; this script "
          f"requires >=2.0. The 1.x STRtree is 50× slower and will take "
          f"days on a continental extract. Update your Dockerfile to "
          f"pip-install 'shapely>=2.0'.", file=sys.stderr)
    sys.exit(1)


# ── Globals shared with workers via fork ────────────────────────────────
# Set in main() before the Pool is created. Workers reference them
# read-only, so copy-on-write keeps them in shared physical pages.
_PARKS_GEOMS: list = []
_PARKS_IDS: list[str] = []
_TREE: STRtree | None = None

# Per-worker output directory. Set in main() before fork; each worker
# opens its own files inside this directory after fork (named by PID).
# This is the fix for the cross-batch byte-level corruption we hit on the
# first NA bake — see the comment in main() near the pool setup.
_WORKER_OUT_DIR: str | None = None
_WORKER_TRAILS_FH = None  # type: ignore[var-annotated]
_WORKER_THRU_FH = None  # type: ignore[var-annotated]


def _log(msg: str) -> None:
    """Unbuffered stderr print. Docker captures stderr line-buffered only when
    a tty is attached; during `docker run` it's fully-buffered by default,
    which is why a long parks-load looked silent overnight. Always flush."""
    print(msg, file=sys.stderr, flush=True)


def _difficulty(length_km: float, gain_m: float | None, sac_scale: str | None) -> str:
    """Coarse difficulty bucket. `sac_scale` overrides distance/gain heuristic."""
    if sac_scale and sac_scale.lower() in {"t3", "t4", "t5", "t6", "demanding_mountain_hiking",
                                            "alpine_hiking", "demanding_alpine_hiking",
                                            "difficult_alpine_hiking"}:
        return "hard"
    if gain_m is not None and length_km > 0:
        ratio = gain_m / length_km
        if ratio > 100:
            return "hard"
        if ratio > 50:
            return "moderate"
    if length_km > 25:
        return "hard"
    if length_km > 10:
        return "moderate"
    return "easy"


def _surface_bucket(raw: str | None) -> str:
    if not raw:
        return "any"
    s = raw.lower()
    if s in {"asphalt", "concrete", "paved", "paving_stones"}:
        return "paved"
    if s in {"gravel", "fine_gravel", "compacted", "pebblestone"}:
        return "gravel"
    return "unpaved"


def _iter_features(path: str) -> Iterator[dict]:
    """Yield GeoJSON Features from either a FeatureCollection JSON or a
    GeoJSON-seq stream (one Feature per line, optionally prefixed with RS).

    Auto-detects by peeking at the file's first 4 KB. The streaming branch
    keeps memory flat for continent-scale WDPA exports that wouldn't fit a
    `json.load()`.
    """
    with open(path, "r") as f:
        head = f.read(4096)
        f.seek(0)
        stripped = head.lstrip().lstrip("\x1e")
        is_feature_collection = (
            stripped.startswith("{") and '"FeatureCollection"' in head
        )

        if is_feature_collection:
            data = json.load(f)
            for feat in data.get("features", []):
                yield feat
            return

        for line in f:
            line = line.strip()
            if line.startswith("\x1e"):
                line = line[1:]
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            t = obj.get("type")
            if t == "Feature":
                yield obj
            elif t == "FeatureCollection":
                for feat in obj.get("features", []):
                    yield feat


def _length_km(geom) -> float:
    """Approximate planar length of a (Multi)LineString in km. Equirectangular
    is fine for the bucket precision we need; off by ±0.05 km on a 25-km
    trail near the poles, which we don't care about."""
    try:
        coords = list(geom.coords) if geom.geom_type == "LineString" else []
        if geom.geom_type == "MultiLineString":
            coords = [pt for line in geom.geoms for pt in line.coords]
        if len(coords) < 2:
            return 0.0
        avg_lat = sum(pt[1] for pt in coords) / len(coords)
        import math
        m_per_deg_lat = 111_320
        m_per_deg_lon = 111_320 * math.cos(math.radians(avg_lat))
        total_m = 0.0
        for (x1, y1), (x2, y2) in zip(coords, coords[1:]):
            dx = (x2 - x1) * m_per_deg_lon
            dy = (y2 - y1) * m_per_deg_lat
            total_m += math.hypot(dx, dy)
        return total_m / 1000
    except Exception:
        return 0.0


# ── Per-trail processing (called both from worker and serial paths) ─────

def _process_one(raw: str) -> tuple[str | None, str | None, str]:
    """Process a single GeoJSON-seq line. Returns (tagged_line, thru_line,
    skip_reason). Either output may be None. Lines include trailing
    newlines; the caller only has to write them.

    skip_reason is one of: '', 'track', 'short', 'parse', 'geom'. Used
    only for the totals at the end.
    """
    raw = raw.strip()
    if raw.startswith("\x1e"):
        raw = raw[1:]
    if not raw:
        return None, None, "parse"
    try:
        feat = json.loads(raw)
    except json.JSONDecodeError:
        return None, None, "parse"

    geom_raw = feat.get("geometry")
    if not geom_raw or geom_raw.get("type") not in ("LineString", "MultiLineString"):
        return None, None, "geom"

    props_in = feat.get("properties") or {}

    # ── Cheap property filters first ───────────────────────────────────
    # Skip ~half of OSM noise (forestry tracks, unnamed footway fragments)
    # before paying for shape() or the spatial query.
    name = props_in.get("name")
    highway = props_in.get("highway")
    sac = props_in.get("sac_scale")

    if highway == "track" and not (sac or name):
        return None, None, "track"

    try:
        geom = shape(geom_raw)
    except Exception:
        return None, None, "geom"
    if geom.is_empty:
        return None, None, "geom"

    length_km = _length_km(geom)
    if length_km < 0.2 and not name:
        return None, None, "short"

    surface = _surface_bucket(props_in.get("surface"))
    gain_m = None
    difficulty = _difficulty(length_km, gain_m, sac)

    informal = "yes" if (props_in.get("informal") == "yes" or
                         props_in.get("trail_visibility") in {"bad", "horrible", "no"}) else "no"

    # Spatial probe: bbox query → point-in-polygon, break on first hit.
    # shapely 2's STRtree.query returns an ndarray of int indices; the
    # startup check above guarantees we're on shapely 2 so no fallback.
    inside_park: str | None = None
    try:
        cand_idx = _TREE.query(geom)
        rep = geom.representative_point()
        for i in cand_idx:
            if _PARKS_GEOMS[i].contains(rep):
                inside_park = _PARKS_IDS[i]
                break
    except Exception:
        pass

    props_out = {
        "name": name,
        "ref":  props_in.get("ref"),
        "surface": surface,
        "difficulty": difficulty,
        "informal": informal,
        "length_km": round(length_km, 2),
    }
    if inside_park is not None:
        props_out["inside_park"] = inside_park
    props_out = {k: v for k, v in props_out.items() if v is not None and v != ""}

    # Strict JSON only (no NaN / Infinity). Osmium's export occasionally
    # emits these for degenerate geometries and Python's json.dumps happily
    # writes them as literal `NaN` / `Infinity` — which Python can re-parse
    # but tippecanoe (strict JSON) rejects, aborting the whole stream at
    # the first bad line. `allow_nan=False` raises on these; we skip the
    # feature with a sentinel so the parent can count it.
    try:
        tagged_line = json.dumps({
            "type": "Feature",
            "properties": props_out,
            "geometry": geom_raw,
        }, allow_nan=False) + "\n"
    except (ValueError, TypeError):
        return None, None, "nan"

    thru_line = None
    route = props_in.get("route") or props_in.get("network")
    ref = props_in.get("ref") or ""
    if route == "hiking" and (name or ref):
        try:
            thru_line = json.dumps({
                "type": "Feature",
                "properties": {"name": name or ref, "ref": ref},
                "geometry": geom_raw,
            }, allow_nan=False) + "\n"
        except (ValueError, TypeError):
            thru_line = None

    return tagged_line, thru_line, ""


def _process_batch(lines: list[str]) -> dict[str, int]:
    """Worker entrypoint. Process a batch of raw lines, write outputs to
    this worker's own per-PID files, and return ONLY a small counters dict.

    Returning the actual feature strings via the multiprocessing result
    pipe (which the original implementation did) caused rare but
    reproducible cross-batch byte-level corruption — adjacent batches
    would arrive with one feature truncated mid-coordinate and another
    feature concatenated directly onto it, no separator. Two valid JSON
    objects in, one corrupt line out, on disk only. We never reproduced
    this in a unit test, so rather than chase a CPython/macOS-fork
    interaction we eliminated the shared output path entirely: each
    worker opens its own file (in `_init_worker`) and only the parent's
    final concatenation phase ever writes to the user-visible output.
    """
    global _WORKER_TRAILS_FH, _WORKER_THRU_FH

    counters = {"in": 0, "out": 0, "thru": 0, "track": 0, "short": 0, "nan": 0, "bad": 0}
    out_t: list[str] = []
    out_h: list[str] = []

    for raw in lines:
        counters["in"] += 1
        t_line, h_line, skip = _process_one(raw)
        if skip == "track":
            counters["track"] += 1
            continue
        if skip == "short":
            counters["short"] += 1
            continue
        if skip == "nan":
            counters["nan"] += 1
            continue
        if t_line is not None:
            out_t.append(t_line)
            counters["out"] += 1
        if h_line is not None:
            out_h.append(h_line)
            counters["thru"] += 1

    # Belt-and-suspenders: even though every line we just appended came
    # from `json.dumps(allow_nan=False)` and is well-formed by
    # construction, re-validate before hitting disk. Anything that fails
    # gets dropped silently and counted in `bad`. The cost is ~5% of
    # wall time and it makes downstream tippecanoe failures impossible
    # to attribute to this script.
    out_t = _validated(out_t)
    out_h = _validated(out_h)

    # Single concatenated write per file per batch. Avoids the per-element
    # `writelines` loop and means each batch produces exactly one syscall
    # of contiguous bytes, with no chance of cross-batch interleaving
    # (the FH is also process-local — only this worker holds it).
    #
    # `flush()` after every batch is required, not optional: multiprocessing
    # Pool workers exit via `os._exit()` in Popen._launch after _bootstrap
    # returns, which skips atexit handlers AND object finalizers — so any
    # data still in Python's userspace buffer at shutdown is silently lost.
    # The high-volume trails file overflows its 1 MiB buffer hundreds of
    # times per worker and survives by accident; the low-volume thru file
    # never overflows and lost ALL of its content on the first NA bake
    # (counters reported 1,272 thru-hikes, concat reported 0 bytes). The
    # explicit flush pushes both files into the OS kernel buffer, which
    # os._exit does NOT discard.
    if out_t:
        _WORKER_TRAILS_FH.write("".join(out_t))  # type: ignore[union-attr]
        _WORKER_TRAILS_FH.flush()                 # type: ignore[union-attr]
    if out_h:
        _WORKER_THRU_FH.write("".join(out_h))    # type: ignore[union-attr]
        _WORKER_THRU_FH.flush()                   # type: ignore[union-attr]

    return counters


def _init_worker():
    """Build a per-worker STRtree from the inherited parks geometries
    AND open this worker's own output files.

    Fork gives us read-only access to `_PARKS_GEOMS` via copy-on-write,
    but the parent's STRtree holds GEOS C-handles that aren't safe to
    share across forks — so each worker rebuilds. ~3-5s per worker on
    a continental parks index, paid once at pool startup.

    Output files: `_WORKER_OUT_DIR/{trails,thru}-<pid>.geojsonl`. They
    use buffered text mode with a generous buffer size so the per-batch
    `write` typically lands in the buffer; `_close_worker_files` (run
    via atexit) flushes on shutdown."""
    global _TREE, _WORKER_TRAILS_FH, _WORKER_THRU_FH
    _TREE = STRtree(_PARKS_GEOMS)

    if _WORKER_OUT_DIR is None:
        raise RuntimeError("_WORKER_OUT_DIR not set before fork")
    pid = os.getpid()
    trails_path = os.path.join(_WORKER_OUT_DIR, f"trails-{pid}.geojsonl")
    thru_path   = os.path.join(_WORKER_OUT_DIR, f"thru-{pid}.geojsonl")
    # 1 MiB buffer — large enough that most batches don't trigger a flush
    # mid-write, but bounded so a crashed worker doesn't lose more than
    # a megabyte of output. Mode "w" truncates anything left over from a
    # crashed previous run with the same PID, which is the desired
    # behaviour (we want a clean slate).
    _WORKER_TRAILS_FH = open(trails_path, "w", buffering=1 << 20)
    _WORKER_THRU_FH   = open(thru_path,   "w", buffering=1 << 20)

    # Register cleanup via BOTH atexit and multiprocessing.util.Finalize.
    # multiprocessing's Pool workers exit through `os._exit(code)` in
    # `Popen._launch` after `_bootstrap` returns; that skips atexit
    # handlers entirely. multiprocessing.util.Finalize entries, on the
    # other hand, are run by `util._exit_function()` which fires from
    # inside `_bootstrap` before the os._exit. We keep the atexit
    # registration as a fallback for the serial path.
    import atexit
    from multiprocessing import util as _mp_util
    atexit.register(_close_worker_files)
    _mp_util.Finalize(None, _close_worker_files, exitpriority=10)


def _close_worker_files():
    """Flush and close per-worker output files. Registered via atexit in
    `_init_worker` so it runs when the worker process exits cleanly
    (which is what `pool.close(); pool.join()` triggers)."""
    global _WORKER_TRAILS_FH, _WORKER_THRU_FH
    for fh in (_WORKER_TRAILS_FH, _WORKER_THRU_FH):
        if fh is not None:
            try:
                fh.flush()
                os.fsync(fh.fileno())
                fh.close()
            except Exception:
                pass
    _WORKER_TRAILS_FH = None
    _WORKER_THRU_FH = None


def _strict_constant(name: str):
    """json.loads calls parse_constant for NaN / Infinity / -Infinity.
    Python accepts these by default (they become float('nan') etc.) but
    tippecanoe's strict JSON parser rejects them. Raising here makes the
    validator reject lines containing those tokens, matching tippecanoe's
    strictness."""
    raise ValueError(f"strict json: rejecting constant {name!r}")


def _validated(lines: list[str]) -> list[str]:
    """Keep only lines whose content round-trips cleanly through a strict
    json.loads. Lines must end in '\\n' to make it through — tippecanoe
    hard-requires line-delimited input."""
    out = []
    for line in lines:
        if not line.endswith("\n"):
            continue
        body = line[:-1]
        try:
            json.loads(body, parse_constant=_strict_constant)
        except Exception:
            continue
        out.append(line)
    return out


def _batched(lines: Iterable[str], size: int) -> Iterator[list[str]]:
    """Group an iterator into chunks of `size`. Used to amortize IPC cost
    across the multiprocessing Pool — sending one line at a time costs
    more in pickling than the work itself."""
    batch: list[str] = []
    for line in lines:
        batch.append(line)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--trails", required=True, help="trails.geojsonseq input")
    ap.add_argument("--parks",  required=True, help="wdpa_poly.geojson input")
    ap.add_argument("--out-trails", required=True)
    ap.add_argument("--out-thru",   required=True)
    ap.add_argument("--bbox", default=None,
                    help="optional west,south,east,north — only load parks whose "
                         "bbox overlaps this window. Skips shape() on the rest, "
                         "which is the single biggest speedup for continental bakes.")
    ap.add_argument("--workers", type=int, default=0,
                    help="parallel workers. 0 = auto (cpu_count - 1), 1 = serial "
                         "in-process (no fork overhead, useful for debugging).")
    ap.add_argument("--batch-size", type=int, default=2000,
                    help="lines per worker batch. Higher = less IPC overhead but "
                         "more memory per in-flight batch and coarser progress.")
    args = ap.parse_args()

    bbox = None
    if args.bbox:
        try:
            w, s, e, n = (float(x) for x in args.bbox.split(","))
            bbox = (w, s, e, n)
        except Exception:
            _log(f"  ignoring malformed --bbox {args.bbox!r}")

    workers = args.workers if args.workers > 0 else max(1, (os.cpu_count() or 2) - 1)

    # ── Phase 1: parks index ──────────────────────────────────────────────
    _log(f"  loading parks index from {args.parks}…")
    t0 = time.time()
    n_seen = n_skipped_bbox = n_invalid = 0
    last_heartbeat = time.time()

    for feat in _iter_features(args.parks):
        n_seen += 1
        if time.time() - last_heartbeat > 5:
            _log(f"    …parks: scanned {n_seen:,}, kept {len(_PARKS_GEOMS):,}, "
                 f"bbox-skipped {n_skipped_bbox:,}, invalid {n_invalid:,}")
            last_heartbeat = time.time()

        # Cheap bbox prefilter from the raw coords. We sample one point to
        # avoid building the full geometry just to discard it. Polygon
        # crossings of the bbox edge will sometimes leak through, which is
        # fine — they'll just sit in the tree unused.
        if bbox is not None:
            try:
                geom_raw = feat.get("geometry") or {}
                coords = geom_raw.get("coordinates") or []
                sample = None
                if geom_raw.get("type") == "Polygon" and coords:
                    sample = coords[0][0] if coords[0] else None
                elif geom_raw.get("type") == "MultiPolygon" and coords:
                    sample = coords[0][0][0] if (coords[0] and coords[0][0]) else None
                if sample is not None:
                    x, y = sample[0], sample[1]
                    w, s, e, n_ = bbox
                    if x < w or x > e or y < s or y > n_:
                        n_skipped_bbox += 1
                        continue
            except Exception:
                pass

        try:
            geom = shape(feat["geometry"])
            if not geom.is_valid:
                geom = geom.buffer(0)
            sid = feat.get("properties", {}).get("SITE_PID")
            if sid is None:
                continue
            _PARKS_GEOMS.append(geom)
            _PARKS_IDS.append(str(sid))
        except Exception:
            n_invalid += 1
            continue

    _log(f"  indexed {len(_PARKS_GEOMS):,} park polygons in {time.time()-t0:.1f}s "
         f"({n_seen:,} scanned, {n_skipped_bbox:,} bbox-skipped, {n_invalid:,} invalid)")

    # ── Phase 2: trails loop ──────────────────────────────────────────────
    n_in = n_out = n_thru = n_skipped_track = n_skipped_short = n_skipped_nan = 0
    t0 = time.time()
    last_heartbeat = time.time()

    if workers > 1:
        # Workers will write directly to per-PID files in this directory
        # rather than shipping their output back through the pool's IPC
        # pipe. See the long comment in `_process_batch` for why. Use a
        # tempdir alongside the final outputs so it lives on the same
        # filesystem (concat phase becomes a fast sendfile on Linux).
        out_dir = os.path.dirname(os.path.abspath(args.out_trails)) or "."
        global _WORKER_OUT_DIR
        _WORKER_OUT_DIR = tempfile.mkdtemp(prefix=".trails-workers-", dir=out_dir)
        _log(f"  spawning {workers} workers (fork) — each will build its own "
             f"STRtree and write to {_WORKER_OUT_DIR}/…")
        ctx = mp.get_context("fork")
        # `chunksize=1` so imap_unordered hands us one batch at a time —
        # we already chunked at the source, no point double-chunking and
        # losing progress granularity.
        pool = ctx.Pool(workers, initializer=_init_worker)
        try:
            with open(args.trails) as src:
                for c in pool.imap_unordered(
                    _process_batch, _batched(src, args.batch_size), chunksize=1,
                ):
                    n_in += c["in"]
                    n_out += c["out"]
                    n_thru += c["thru"]
                    n_skipped_track += c["track"]
                    n_skipped_short += c["short"]
                    n_skipped_nan += c.get("nan", 0)

                    if time.time() - last_heartbeat > 10:
                        elapsed = time.time() - t0
                        rate = n_in / elapsed if elapsed > 0 else 0
                        _log(f"    …trails: read {n_in:,}, wrote {n_out:,} tagged + "
                             f"{n_thru:,} thru ({rate:,.0f}/s, {workers}w)")
                        last_heartbeat = time.time()
        finally:
            # `pool.close(); pool.join()` lets each worker run its
            # atexit handlers, which is what flushes & fsyncs their
            # output files. Don't move the concat below before this!
            pool.close()
            pool.join()

        # ── Concat phase ─────────────────────────────────────────────
        # Each worker produced its own trails-<pid>.geojsonl and
        # thru-<pid>.geojsonl. Stitch them into the final outputs in a
        # single sequential pass per file. Binary mode + shutil keeps
        # this at memcpy speeds; on a 6 GB tagged stream this is ~30 s.
        trail_parts = sorted(glob.glob(os.path.join(_WORKER_OUT_DIR, "trails-*.geojsonl")))
        thru_parts  = sorted(glob.glob(os.path.join(_WORKER_OUT_DIR, "thru-*.geojsonl")))
        _log(f"  concatenating {len(trail_parts)} worker shards into "
             f"{args.out_trails} and {args.out_thru}…")
        t_concat = time.time()
        bytes_t = bytes_h = 0
        with open(args.out_trails, "wb") as out:
            for p in trail_parts:
                with open(p, "rb") as src:
                    shutil.copyfileobj(src, out, length=1 << 22)
                bytes_t += os.path.getsize(p)
        with open(args.out_thru, "wb") as out:
            for p in thru_parts:
                with open(p, "rb") as src:
                    shutil.copyfileobj(src, out, length=1 << 22)
                bytes_h += os.path.getsize(p)
        # Clean up shard directory now that we've written the final files.
        try:
            for p in trail_parts + thru_parts:
                os.unlink(p)
            os.rmdir(_WORKER_OUT_DIR)
        except Exception:
            pass
        _log(f"  concat done in {time.time()-t_concat:.1f}s "
             f"(trails={bytes_t/1e9:.2f} GB, thru={bytes_h/1e6:.2f} MB)")
    else:
        # Serial path — also useful when --workers=1 for debugging without
        # fork. Build the tree in-process here.
        _log("  serial mode (--workers=1), building STRtree in-process…")
        global _TREE
        _TREE = STRtree(_PARKS_GEOMS)
        with open(args.trails) as src, \
             open(args.out_trails, "w") as out_t, \
             open(args.out_thru,   "w") as out_h:
            for raw in src:
                n_in += 1
                t_line, h_line, skip = _process_one(raw)
                if skip == "track":
                    n_skipped_track += 1
                elif skip == "short":
                    n_skipped_short += 1
                elif skip == "nan":
                    n_skipped_nan += 1
                else:
                    if t_line is not None:
                        out_t.write(t_line)
                        n_out += 1
                    if h_line is not None:
                        out_h.write(h_line)
                        n_thru += 1

                if time.time() - last_heartbeat > 10:
                    elapsed = time.time() - t0
                    rate = n_in / elapsed if elapsed > 0 else 0
                    _log(f"    …trails: read {n_in:,}, wrote {n_out:,} tagged + "
                         f"{n_thru:,} thru ({rate:,.0f}/s, serial)")
                    last_heartbeat = time.time()

    elapsed = time.time() - t0
    rate = n_in / elapsed if elapsed > 0 else 0
    _log(f"  read {n_in:,} trails in {elapsed:.1f}s ({rate:,.0f}/s); "
         f"wrote {n_out:,} tagged + {n_thru:,} thru-hikes")
    _log(f"  dropped {n_skipped_track:,} unnamed tracks, "
         f"{n_skipped_short:,} short unnamed fragments, "
         f"{n_skipped_nan:,} features with NaN/Infinity in coords")


if __name__ == "__main__":
    main()
