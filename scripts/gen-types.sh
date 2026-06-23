#!/usr/bin/env bash
set -euo pipefail
: "${SUPABASE_PROJECT_ID:?defina SUPABASE_PROJECT_ID}"
supabase gen types typescript --project-id "$SUPABASE_PROJECT_ID" > src/lib/database.types.ts
