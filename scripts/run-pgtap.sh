#!/usr/bin/env bash
set -euo pipefail
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL não definido; suíte pgTAP preparada em supabase/tests, mas não executada neste ambiente."
  exit 0
fi
if command -v pg_prove >/dev/null 2>&1; then
  pg_prove --dbname "$DATABASE_URL" supabase/tests/*.sql
else
  psql "$DATABASE_URL" -f supabase/tests/tenant_isolation.test.sql
fi
