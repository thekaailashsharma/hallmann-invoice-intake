#!/usr/bin/env bash
# Builds the deliverable zip (no secrets, no node_modules).
set -euo pipefail
cd "$(dirname "$0")/.."
npm test --silent >/dev/null && python3 scripts/build-workflows.py >/dev/null
OUT="../hallmann-invoice-intake-$(date +%Y%m%d).zip"
rm -f "$OUT"
zip -qr "$OUT" README.md docker-compose.yml .env.example package.json db workflows shared app scripts tests fixtures -x "app/node_modules/*" ".env" "*.DS_Store"
echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
