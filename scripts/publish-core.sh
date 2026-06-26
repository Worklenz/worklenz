#!/usr/bin/env bash
# publish-core.sh — Strip EE code and sync the open-core tree to the public repo.
#
# Usage:
#   PUBLIC_REMOTE_URL=https://github.com/Worklenz/worklenz.git \
#     ./scripts/publish-core.sh [--dry-run] [--branch <branch>]
#
# Required env:
#   PUBLIC_REMOTE_URL  — HTTPS or SSH URL of the public GitHub repository.
#
# Optional env / flags:
#   PUBLISH_BRANCH     — Branch to push to on the public repo. Default: main
#   PRIVATE_BRANCH     — Branch to archive from private repo. Default: current HEAD
#   DRY_RUN=1          — Stage the tree and print its path; do not push. Also --dry-run flag.
#   SKIP_LEAK_GUARD=1  — Skip the EE leak guard (not recommended).

set -euo pipefail

# ─── Parse flags ─────────────────────────────────────────────────────────────
DRY_RUN="${DRY_RUN:-0}"
PUBLISH_BRANCH="${PUBLISH_BRANCH:-main}"
SKIP_LEAK_GUARD="${SKIP_LEAK_GUARD:-0}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --branch)  shift; PUBLISH_BRANCH="$1" ;;
    *) echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
  shift
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
PRIVATE_BRANCH="${PRIVATE_BRANCH:-$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)}"
PUBLIC_REMOTE_URL="${PUBLIC_REMOTE_URL:-}"

if [[ -z "$PUBLIC_REMOTE_URL" && "$DRY_RUN" == "0" ]]; then
  echo "✗ PUBLIC_REMOTE_URL is required (e.g. https://github.com/Worklenz/worklenz.git)" >&2
  exit 1
fi

STAGING_DIR="$(mktemp -d -t worklenz-core-publish.XXXXXX)"
PUBLIC_CLONE=""
cleanup() {
  rm -rf "$STAGING_DIR"
  [[ -n "$PUBLIC_CLONE" ]] && rm -rf "$PUBLIC_CLONE"
}
trap cleanup EXIT

echo "▶ Worklenz open-core publish"
echo "  Private repo   : $REPO_ROOT"
echo "  Private branch : $PRIVATE_BRANCH"
echo "  Staging dir    : $STAGING_DIR"
if [[ "$DRY_RUN" == "1" ]]; then
  echo "  MODE           : DRY RUN (no push)"
else
  echo "  Public repo    : $PUBLIC_REMOTE_URL"
  echo "  Publish branch : $PUBLISH_BRANCH"
fi
echo ""

# ─── Step 1: Export a clean archive ──────────────────────────────────────────
echo "→ [1/5] Exporting archive of $PRIVATE_BRANCH..."
git -C "$REPO_ROOT" archive "$PRIVATE_BRANCH" | tar -x -C "$STAGING_DIR"

# ─── Step 2: Strip EE-only paths ─────────────────────────────────────────────
echo "→ [2/5] Stripping EE directories and files..."

EE_DIRS=(
  "worklenz-backend/src/ee"
  "worklenz-backend/database/migrations-ee"
  "worklenz-frontend/worklenz-ee"
  "worklenz-client-portal"
  "docs"
)
EE_FILES=(
  "worklenz-backend/database/sql/1_tables_ee.sql"
  "DIRECTPAY_SETUP.md"
)

for d in "${EE_DIRS[@]}"; do
  target="$STAGING_DIR/$d"
  if [[ -d "$target" ]]; then
    rm -rf "$target"
    echo "  removed dir : $d"
  fi
done

for f in "${EE_FILES[@]}"; do
  target="$STAGING_DIR/$f"
  if [[ -f "$target" ]]; then
    rm -f "$target"
    echo "  removed file: $f"
  fi
done

# ─── Step 3: Write CE env templates ──────────────────────────────────────────
echo "→ [3/5] Writing CE env configuration..."

# Backend: derive CE template by removing EE-only variable sections
BACKEND_TEMPLATE="$STAGING_DIR/worklenz-backend/.env.template"
if [[ -f "$BACKEND_TEMPLATE" ]]; then
  python3 - <<'PYEOF' "$BACKEND_TEMPLATE"
import sys, re

# Section comment fragments that mark EE-only config blocks
EE_SECTIONS = [
    "DIRECTPAY", "PADDLE", "APPSUMO",
    "SLACK INTEGRATION", "CLIENT_PORTAL_HOSTNAME",
]
# Individual variable prefixes that are EE-only
EE_VAR_PREFIXES = [
    "DP_",
    "CLIENT_PORTAL_HOSTNAME",
    "ENCRYPTION_KEY", "ENCRYPTION_SALT",  # only used by client portal
    # Slack OAuth (the SLACK_WEBHOOK internal notifier var is CE-ok)
    "SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET",
    "SLACK_SIGNING_SECRET", "SLACK_VERIFICATION_TOKEN",
    "SLACK_REDIRECT_URI", "SLACK_APP_ID",
]

path = sys.argv[1]
with open(path) as f:
    lines = f.readlines()

out = ["EDITION=ce\n\n"]
skip_section = False
for line in lines:
    stripped = line.strip()

    # A comment line may start a new section
    if stripped.startswith("#"):
        in_ee = any(h in stripped.upper() for h in EE_SECTIONS)
        if in_ee:
            skip_section = True
            continue
        else:
            # Non-EE section comment — reset the skip flag
            skip_section = False
            out.append(line)
        continue

    # Blank lines break sections
    if stripped == "":
        skip_section = False
        out.append(line)
        continue

    if skip_section:
        continue

    # EE-only var assignment (even outside a marked section)
    if any(stripped.startswith(p) for p in EE_VAR_PREFIXES):
        continue

    out.append(line)

# Write a separate CE template alongside the original
ce_path = path.replace(".env.template", ".env.ce.template")
with open(ce_path, "w") as f:
    f.writelines(out)
print(f"  wrote: worklenz-backend/.env.ce.template")
PYEOF
fi

# Frontend: ensure VITE_EDITION=ce in .env.example
FRONTEND_ENV="$STAGING_DIR/worklenz-frontend/.env.example"
if [[ -f "$FRONTEND_ENV" ]]; then
  if grep -q "^VITE_EDITION=" "$FRONTEND_ENV"; then
    sed -i 's/^VITE_EDITION=.*/VITE_EDITION=ce/' "$FRONTEND_ENV"
  else
    printf "\n# Edition\nVITE_EDITION=ce\n" >> "$FRONTEND_ENV"
  fi
  echo "  set VITE_EDITION=ce in worklenz-frontend/.env.example"
fi

# ─── Step 4: Leak guard ───────────────────────────────────────────────────────
echo "→ [4/5] Running EE leak guard..."

if [[ "$SKIP_LEAK_GUARD" == "1" ]]; then
  echo "  ⚠ SKIP_LEAK_GUARD=1 — skipping (not recommended in CI)"
else
  bash "$SCRIPT_DIR/ee-leak-guard.sh" "$STAGING_DIR"
fi

# ─── Step 5: Push to public repo ─────────────────────────────────────────────
if [[ "$DRY_RUN" == "1" ]]; then
  echo ""
  echo "→ [5/5] DRY RUN — staged tree ready at: $STAGING_DIR"
  echo "  Inspect and compare; nothing was pushed."
  echo "  Re-run without --dry-run to publish."
  trap - EXIT  # leave staging dir on disk for inspection
  exit 0
fi

echo "→ [5/5] Syncing to public repo..."
PUBLIC_CLONE="$(mktemp -d -t worklenz-public-clone.XXXXXX)"

# Clone (or init if first publish) public repo
if git clone --depth=1 --branch "$PUBLISH_BRANCH" "$PUBLIC_REMOTE_URL" "$PUBLIC_CLONE" 2>/dev/null; then
  echo "  cloned branch '$PUBLISH_BRANCH'"
else
  # Branch doesn't exist yet — clone default and create branch
  git clone --depth=1 "$PUBLIC_REMOTE_URL" "$PUBLIC_CLONE"
  git -C "$PUBLIC_CLONE" checkout -b "$PUBLISH_BRANCH"
  echo "  cloned and created branch '$PUBLISH_BRANCH'"
fi

# Replace public repo contents (preserve .git and any top-level dot-files the
# public repo may maintain independently, e.g. .github/workflows)
find "$PUBLIC_CLONE" -mindepth 1 -maxdepth 1 \
  ! -name ".git" \
  ! -name ".github" \
  -exec rm -rf {} +

# Copy staged CE tree
cp -a "$STAGING_DIR/." "$PUBLIC_CLONE/"

# Commit
cd "$PUBLIC_CLONE"
git add -A

COMMIT_SHA="$(git -C "$REPO_ROOT" rev-parse --short "$PRIVATE_BRANCH")"
git -c user.name="Worklenz Bot" \
    -c user.email="ci@worklenz.com" \
    commit -m "chore: sync open-core from private repo (${PRIVATE_BRANCH}@${COMMIT_SHA})" \
    --allow-empty

git push origin "HEAD:${PUBLISH_BRANCH}"

echo ""
echo "✓ Published open-core to: $PUBLIC_REMOTE_URL"
echo "  Branch : $PUBLISH_BRANCH"
echo "  Source : ${PRIVATE_BRANCH}@${COMMIT_SHA}"
