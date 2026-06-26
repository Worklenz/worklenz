#!/usr/bin/env bash
# ee-leak-guard.sh — Verify a directory tree contains no EE-only code.
#
# Usage:
#   scripts/ee-leak-guard.sh <staged-tree-root>
#
# Returns 0 on clean, 1 on any violation. Called by publish-core.sh after
# stripping EE directories but can also be run standalone against the private
# repo to audit the current seam integrity.

set -euo pipefail

TREE="${1:-.}"
LEAKS=0

fail() {
  echo "  ✗ LEAK: $*" >&2
  LEAKS=$((LEAKS + 1))
}

# ─── 1. EE directories must not exist in the published tree ──────────────────
[[ -d "$TREE/worklenz-backend/src/ee" ]] \
  && fail "worklenz-backend/src/ee/ was not stripped"

[[ -d "$TREE/worklenz-frontend/worklenz-ee" ]] \
  && fail "worklenz-frontend/worklenz-ee/ was not stripped"

[[ -d "$TREE/worklenz-client-portal" ]] \
  && fail "worklenz-client-portal/ was not stripped"

# ─── 2. No backend source imports from src/ee ────────────────────────────────
# This catches any import path containing /ee/ that survived the strip step.
if grep -rn --include="*.ts" --include="*.js" \
     -E "from ['\"](\.\./)*ee/" \
     "$TREE/worklenz-backend/src/" 2>/dev/null; then
  fail "Backend source file imports from src/ee/ (boundary violation)"
fi

# ─── 3. No frontend source uses a *non-aliased* path to worklenz-ee ─────────
# `@/worklenz-ee/` is the correct Vite alias (resolves to worklenz-ce/ when
# VITE_EDITION=ce). Only flag relative paths that bypass the alias and would
# point directly at the (stripped) worklenz-ee/ directory.
if grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
     -E "from ['\"](\.\./)*worklenz-ee/" \
     "$TREE/worklenz-frontend/src/" 2>/dev/null; then
  fail "Frontend source file imports worklenz-ee/ via relative path (must use @/worklenz-ee/ alias)"
fi

# ─── 4. No direct Paddle SDK or AppSumo SDK imports in backend src ───────────
# (paddle-utils and paddle-requests are internal — if they're in src/shared/ they're
# excluded from this check. This guard catches accidental raw paddle-sdk imports.)
if grep -rn --include="*.ts" \
     -E "from ['\"]@paddle/paddle-node-sdk['\"]|require\(['\"]paddle" \
     "$TREE/worklenz-backend/src/" 2>/dev/null | grep -v "/ee/" | grep -v "^Binary"; then
  fail "Backend core source imports Paddle SDK directly (must go via src/ee/)"
fi

# ─── 5. EDITION env vars must not be set to 'ee' in published templates ──────
for template in \
  "$TREE/worklenz-backend/.env.template" \
  "$TREE/worklenz-backend/.env.ce.template" \
  "$TREE/worklenz-frontend/.env.example"; do
  [[ -f "$template" ]] || continue
  if grep -qE "^EDITION=ee|^VITE_EDITION=ee" "$template"; then
    fail "$template sets EDITION=ee — must be 'ce' in published tree"
  fi
done

# ─── Result ──────────────────────────────────────────────────────────────────
if [[ "$LEAKS" -gt 0 ]]; then
  echo "" >&2
  echo "✗ Leak guard: $LEAKS violation(s) found." >&2
  exit 1
fi

echo "  ✓ Leak guard: clean"
