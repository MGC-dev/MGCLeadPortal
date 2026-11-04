#!/usr/bin/env bash
# Builds the static showcase site: landing page at /, demo at /demo/, the app at /app/.
# Usage: scripts/build-showcase-site.sh <base-path>   e.g. /MGCLeadPortal/
set -euo pipefail
BASE="${1:-/}"
OUT=site
rm -rf "$OUT"
npx vite build --base "${BASE}app/" --outDir "$OUT/app" --emptyOutDir
cp -R showcase/landing/. "$OUT/"
mkdir -p "$OUT/demo" && cp -R showcase/demo/. "$OUT/demo/"
# Deep links into the app (e.g. /app/pipeline) fall back to the app shell.
cp "$OUT/app/index.html" "$OUT/404.html"
touch "$OUT/.nojekyll"
echo "Built $OUT for base $BASE"
