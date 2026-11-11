#!/usr/bin/env bash
# Builds the static site for GitHub Pages: the app at the site root.
# Usage: scripts/build-site.sh <base-path>   e.g. /Unir/
set -euo pipefail
BASE="${1:-/}"
OUT=site
rm -rf "$OUT"
npx vite build --base "$BASE" --outDir "$OUT" --emptyOutDir
# Deep links (e.g. /pipeline) fall back to the app shell.
cp "$OUT/index.html" "$OUT/404.html"
touch "$OUT/.nojekyll"
echo "Built $OUT for base $BASE"
