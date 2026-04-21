#!/usr/bin/env python3
"""Show the exact content around the JSON parse failure on a specific
line of trails-tagged.geojsonseq. Run this on the host:

    python3 ~/Documents/PRJ/2026/silkymaps/scripts/inspect-bad-line.py [line]

Default file:  ~/Documents/PRJ/2026/spatialData/.trails-build-cache/trails-tagged.geojsonseq
Default line:  17548
"""
from __future__ import annotations

import json
import os
import sys

DEFAULT_FILE = os.path.expanduser(
    "~/Documents/PRJ/2026/spatialData/.trails-build-cache/trails-tagged.geojsonseq"
)


def main() -> int:
    line_no = int(sys.argv[1]) if len(sys.argv) > 1 else 17548
    path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_FILE

    if not os.path.exists(path):
        print(f"ERROR: not found: {path}", file=sys.stderr)
        return 1

    with open(path) as f:
        for i, line in enumerate(f, 1):
            if i == line_no:
                target = line
                break
        else:
            print(f"ERROR: file has fewer than {line_no} lines", file=sys.stderr)
            return 1

    body = target.rstrip("\n")
    print(f"file        : {path}")
    print(f"line        : {line_no}")
    print(f"length      : {len(target)} bytes ({len(body)} body + {len(target) - len(body)} terminator)")
    print(f"endswith \\n: {target.endswith(chr(10))}")
    print()

    # Try to parse strictly. If it fails, the exception carries the byte
    # offset of the failure — we'll annotate that position visually.
    try:
        json.loads(body)
        print("note: line parses cleanly under strict JSON. (line might still "
              "contain content past the closing brace that confuses tippecanoe.)")
    except json.JSONDecodeError as e:
        col = e.colno - 1  # JSONDecodeError uses 1-indexed column
        print(f"PARSE FAILURE: {e.msg}")
        print(f"  at char {col} (line 1 column {e.colno})")
        print()
        print("── 80 chars centered on the failure ──")
        lo = max(0, col - 40)
        hi = min(len(body), col + 40)
        slice_ = body[lo:hi]
        # Show the slice plus a caret pointing at the failure column
        # within the slice.
        print(repr(slice_))
        caret = " " * (col - lo + 1) + "^"  # +1 for the leading quote in repr
        print(caret)
        print()

    # Locate every `]],` and `]]` sequence — that's where adjacent
    # coordinate pairs join. A missing comma will show up as `]][` (no
    # separator between two pairs).
    print("── suspicious adjacent-pair patterns ──")
    seen = []
    needles = ("]] [", "]][", "}{", ", ,", "][", "][[")
    for needle in needles:
        idx = body.find(needle)
        while idx != -1:
            seen.append((idx, needle, body[max(0, idx - 30):idx + 60]))
            idx = body.find(needle, idx + 1)
    if not seen:
        print("(none found)")
    else:
        for off, needle, ctx in seen[:10]:
            print(f"  @char {off:5d}  {needle!r:>10}  …{ctx!r}…")

    print()
    print("── full line (wrapped at 200 chars/line for readability) ──")
    for i in range(0, len(body), 200):
        marker = ""
        # If the parse failure is in this wrapped chunk, mark it.
        try:
            err_col = json.JSONDecodeError("", "", 0).colno  # noqa
        except Exception:
            pass
        print(f"[{i:5d}] {body[i:i + 200]}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
