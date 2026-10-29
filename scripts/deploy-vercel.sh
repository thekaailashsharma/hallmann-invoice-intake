#!/usr/bin/env bash
# Deploys the review screen to Vercel. Static files from app/public; every /api/* call is forwarded to the backend
# (BACKEND_URL, e.g. the Cloudflare tunnel to the running stack, or a production server). Usage: scripts/deploy-vercel.sh https://backend.example
set -euo pipefail; cd "$(dirname "$0")/.."
BACKEND="${1:?backend URL, e.g. https://xyz.trycloudflare.com}"; BACKEND="${BACKEND%/}"
OUT=.vercel-site; mkdir -p "$OUT"; cp -R app/public/. "$OUT/"
CSP="default-src 'self'; script-src 'self' https://www.gstatic.com https://apis.google.com https://cdnjs.cloudflare.com; worker-src 'self' blob: https://cdnjs.cloudflare.com; connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com https://*.firebase.com https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://*.googleusercontent.com; frame-src https://*.firebaseapp.com https://accounts.google.com blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
cat > "$OUT/vercel.json" <<JSON
{
  "rewrites": [ { "source": "/api/:path*", "destination": "$BACKEND/api/:path*" } ],
  "headers": [ { "source": "/(.*)", "headers": [
    { "key": "Content-Security-Policy", "value": "$CSP" },
    { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains" },
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "Referrer-Policy", "value": "no-referrer" },
    { "key": "Cross-Origin-Opener-Policy", "value": "same-origin-allow-popups" } ] } ]
}
JSON
cd "$OUT" && vercel deploy --prod --yes --name hallmann-invoices 2>&1 | tail -4
