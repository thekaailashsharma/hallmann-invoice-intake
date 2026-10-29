#!/usr/bin/env bash
# Test tooling: simulate unannounced ERP maintenance on the mock ERP.  Usage: scripts/erp.sh down | up | status
set -euo pipefail; cd "$(dirname "$0")/.."; KEY=$(grep '^ERP_API_KEY=' .env | cut -d= -f2)
case "${1:-status}" in
  down) curl -s -X POST localhost:4000/admin/maintenance -H "x-erp-key: $KEY" -H 'content-type: application/json' -d '{"on":true}' ;;
  up)   curl -s -X POST localhost:4000/admin/maintenance -H "x-erp-key: $KEY" -H 'content-type: application/json' -d '{"on":false}' ;;
  *)    curl -s localhost:4000/health -H "x-erp-key: $KEY" ;;
esac; echo
