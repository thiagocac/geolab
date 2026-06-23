#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?defina DATABASE_URL}"
psql "$DATABASE_URL" -f supabase/seed/seed-demo.sql
