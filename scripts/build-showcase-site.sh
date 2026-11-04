#!/usr/bin/env bash
# Builds the static showcase site: the demo at /, the app at /app/.
# Usage: scripts/build-showcase-site.sh <base-path>   e.g. /MGCLeadPortal/
set -euo pipefail
BASE="${1:-/}"
OUT=site
rm -rf "$OUT"
npx vite build --base "${BASE}app/" --outDir "$OUT/app" --emptyOutDir
cp -R showcase/demo/. "$OUT/"
# Old /demo/ links redirect to the home page.
mkdir -p "$OUT/demo"
printf '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=../"><link rel="canonical" href="../"><title>MGC CRM Demo</title><a href="../">MGC CRM Demo</a>\n' > "$OUT/demo/index.html"
# Deep links into the app (e.g. /app/pipeline) fall back to the app shell.
cp "$OUT/app/index.html" "$OUT/404.html"
touch "$OUT/.nojekyll"
echo "Built $OUT for base $BASE"
