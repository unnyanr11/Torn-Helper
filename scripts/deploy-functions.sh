#!/usr/bin/env bash
# Torn Command Center - Deploy Edge Functions via Supabase CLI
# Usage: ./scripts/deploy-functions.sh

set -euo pipefail

# Check CLI installed
if ! command -v supabase &> /dev/null; then
  echo "Error: Supabase CLI not found. Install with: npm install -g supabase"
  exit 1
fi

# Check logged in
if ! supabase projects list &> /dev/null; then
  echo "Error: Not logged in. Run: supabase login"
  exit 1
fi

# Link project (idempotent)
PROJECT_REF="caxhhhtrlqfuatraamto"
echo "Linking project $PROJECT_REF..."
supabase link --project-ref "$PROJECT_REF"

# Deploy functions
echo "Deploying verify-loss-payment..."
supabase functions deploy verify-loss-payment

echo "Deploying verify-loss-funding..."
supabase functions deploy verify-loss-funding

echo "All functions deployed successfully."

echo "Verifying deployment..."
curl -s -X POST "https://${PROJECT_REF}.supabase.co/functions/v1/verify-loss-funding" \
  -H "Content-Type: application/json" \
  -d '{}' | head -c 500
echo ""
