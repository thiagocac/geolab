#!/usr/bin/env bash
set -euo pipefail
supabase db push
for fn in supabase/functions/*; do
  [ -d "$fn" ] || continue
  name="$(basename "$fn")"
  [ "$name" = "_shared" ] && continue
  supabase functions deploy "$name"
done
