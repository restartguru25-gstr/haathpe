#!/bin/bash
# Deploy set-mpin with JWT verification disabled (fixes 401 in production).
# Run: ./scripts/deploy-set-mpin.sh
# Or: supabase functions deploy set-mpin --no-verify-jwt
set -e
cd "$(dirname "$0")/.."
supabase functions deploy set-mpin --no-verify-jwt
echo "Done. set-mpin deployed with --no-verify-jwt"
