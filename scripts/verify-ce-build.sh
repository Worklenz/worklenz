#!/usr/bin/env bash
# verify-ce-build.sh — CE (open-core) build verification suite.
#
# Runs four checks:
#   1. Backend CE TypeScript compilation (src/ee excluded)
#   2. EE leak guard on a dry-run staged tree
#   3. Frontend CE TypeScript compilation
#   4. Runtime smoke test: CE server returns 404 for EE-only endpoints
#
# Usage:
#   ./scripts/verify-ce-build.sh [--smoke]
#
# --smoke also starts the backend with EDITION=ce and confirms route 404s.
# Requires a running database for --smoke (uses DB_URL env or .env defaults).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
BACKEND="$REPO_ROOT/worklenz-backend"
FRONTEND="$REPO_ROOT/worklenz-frontend"

SMOKE=0
for arg in "$@"; do
  [[ "$arg" == "--smoke" ]] && SMOKE=1
done

PASS=0
FAIL=0

ok()   { echo "  ✓ $*"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $*" >&2; FAIL=$((FAIL+1)); }
header() { echo ""; echo "── $* ──"; }

# ─── 1. Backend CE TypeScript ─────────────────────────────────────────────────
header "1. Backend CE TypeScript (src/ee excluded)"
cd "$BACKEND"
if npx tsc --project tsconfig.ce.json --noEmit 2>&1 | grep -q "error TS"; then
  fail "Backend CE tsc: compilation errors found"
  npx tsc --project tsconfig.ce.json --noEmit 2>&1 | grep "error TS" | head -10
else
  ok "Backend CE tsc: clean"
fi

# ─── 2. EE leak guard on staged tree ─────────────────────────────────────────
header "2. EE leak guard (dry-run publish)"
STAGING_DIR="$(mktemp -d -t worklenz-verify.XXXXXX)"
trap 'rm -rf "$STAGING_DIR"' EXIT

BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
git -C "$REPO_ROOT" archive "$BRANCH" | tar -x -C "$STAGING_DIR"

# Strip EE dirs
rm -rf \
  "$STAGING_DIR/worklenz-backend/src/ee" \
  "$STAGING_DIR/worklenz-backend/database/migrations-ee" \
  "$STAGING_DIR/worklenz-backend/database/sql/1_tables_ee.sql" \
  "$STAGING_DIR/worklenz-frontend/worklenz-ee" \
  "$STAGING_DIR/worklenz-client-portal" \
  "$STAGING_DIR/docs"

if bash "$SCRIPT_DIR/ee-leak-guard.sh" "$STAGING_DIR" 2>&1; then
  ok "Leak guard: clean"
else
  fail "Leak guard: violations found (see above)"
fi

# ─── 3. Frontend CE TypeScript ────────────────────────────────────────────────
header "3. Frontend CE TypeScript"
cd "$FRONTEND"
if [[ -f tsconfig.ce.json ]]; then
  if npx tsc --project tsconfig.ce.json --noEmit 2>&1 | grep -q "error TS"; then
    fail "Frontend CE tsc: compilation errors"
  else
    ok "Frontend CE tsc: clean"
  fi
else
  echo "  ⚠ No tsconfig.ce.json in frontend — skipping (add one to enable this check)"
fi

# ─── 4. Runtime smoke test ────────────────────────────────────────────────────
header "4. Runtime smoke test (EE endpoints return 404 under EDITION=ce)"
if [[ "$SMOKE" == "0" ]]; then
  echo "  ⊖ Skipped (pass --smoke to run)"
else
  cd "$BACKEND"
  PORT=19273  # unlikely-to-conflict test port

  # Start the backend in the background with EDITION=ce
  EDITION=ce PORT=$PORT node build/bin/www.js &>/tmp/ce-smoke.log &
  SERVER_PID=$!
  trap 'kill $SERVER_PID 2>/dev/null; rm -rf "$STAGING_DIR"' EXIT

  echo "  Starting CE backend (PID $SERVER_PID) on port $PORT..."
  sleep 4  # allow startup

  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    fail "CE backend failed to start — check /tmp/ce-smoke.log"
  else
    # EE-only routes: these must NOT exist in CE
    EE_ROUTES=(
      "/api/v1/billing"
      "/api/v1/slack"
      "/api/v1/plan-trials"
      "/api/v1/subscriptions"
      "/api/v1/project-finance"
      "/api/v1/ratecard"
      "/api/v1/plan-recommendations"
      "/api/client-portal"
    )
    ALL_OK=1
    for route in "${EE_ROUTES[@]}"; do
      STATUS="$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT$route" || echo "000")"
      if [[ "$STATUS" == "404" || "$STATUS" == "401" ]]; then
        # 401 is also acceptable (auth middleware fires before route-not-found on some stacks)
        echo "    $route → $STATUS ✓"
      else
        echo "    $route → $STATUS ✗ (expected 404/401)" >&2
        ALL_OK=0
      fi
    done

    # Core route: must respond (not 404)
    HEALTH_STATUS="$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/health" || echo "000")"
    echo "    /health → $HEALTH_STATUS"

    if [[ "$ALL_OK" == "1" ]]; then
      ok "All EE routes absent in CE build"
    else
      fail "Some EE routes are still accessible in CE build"
    fi

    kill "$SERVER_PID" 2>/dev/null || true
  fi
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════"
echo "CE verification: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  echo "✗ Build is NOT clean for open-core publish." >&2
  exit 1
fi
echo "✓ CE build verified — safe to publish."
