#!/usr/bin/env bash
#
# Build a clean public (OSS) tree from the current commit.
#
# Materialises every tracked file EXCEPT those matched by exclude.txt (minus
# anything rescued by allow.txt) into an output directory. That directory is
# meant to be pushed to the public repo as a single squashed commit with no
# prior history, so nothing here touches git history — it is a pure file copy.
#
# Usage:
#   scripts/oss-export/build-oss-tree.sh [OUTPUT_DIR]
#
# Default OUTPUT_DIR: ../worklenz-oss-export (sibling of the repo)
#
# The script never pushes and never deletes the repo's own files. Review the
# output dir, run the builds/tests inside it, then push it yourself.

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
here="$repo_root/scripts/oss-export"
out="${1:-$repo_root/../worklenz-oss-export}"

exclude_file="$here/exclude.txt"
allow_file="$here/allow.txt"

[ -f "$exclude_file" ] || { echo "missing $exclude_file" >&2; exit 1; }

# --- resolve the file list -------------------------------------------------
mapfile -t all_tracked < <(git -C "$repo_root" ls-files)

# Build pathspec args for git check-ignore-style matching. We reuse
# `git ls-files` with exclude pathspecs so directory prefixes and globs behave
# exactly like git.
exclude_specs=()
while IFS= read -r line; do
  line="${line%%#*}"; line="${line## }"; line="${line%% }"
  [ -z "$line" ] && continue
  exclude_specs+=(":(exclude,glob)$line" ":(exclude,glob)$line/**")
done < "$exclude_file"

mapfile -t kept < <(git -C "$repo_root" ls-files -- . "${exclude_specs[@]}")

# Re-add allowlisted files.
if [ -f "$allow_file" ]; then
  while IFS= read -r line; do
    line="${line%%#*}"; line="${line## }"; line="${line%% }"
    [ -z "$line" ] && continue
    if git -C "$repo_root" ls-files --error-unmatch -- "$line" >/dev/null 2>&1; then
      kept+=("$line")
    else
      echo "warn: allowlist entry not a tracked file: $line" >&2
    fi
  done < "$allow_file"
fi

# Dedup.
mapfile -t kept < <(printf '%s\n' "${kept[@]}" | sort -u)

# --- report --------------------------------------------------------------
total=${#all_tracked[@]}
keep=${#kept[@]}
drop=$(( total - keep ))
echo "tracked files : $total"
echo "  kept        : $keep"
echo "  excluded    : $drop"
echo
echo "excluded paths:"
comm -23 <(printf '%s\n' "${all_tracked[@]}" | LC_ALL=C sort -u) \
        <(printf '%s\n' "${kept[@]}" | LC_ALL=C sort -u)
echo

read -r -p "Write clean tree to: $out  ? [y/N] " ans
[ "$ans" = "y" ] || [ "$ans" = "Y" ] || { echo "aborted"; exit 0; }

# --- materialise --------------------------------------------------------
rm -rf "$out"
mkdir -p "$out"
printf '%s\0' "${kept[@]}" | while IFS= read -r -d '' f; do
  mkdir -p "$out/$(dirname "$f")"
  git -C "$repo_root" show "HEAD:$f" > "$out/$f" 2>/dev/null \
    || cp "$repo_root/$f" "$out/$f"   # fallback for anything odd
done

echo
echo "done -> $out"
echo
echo "next:"
echo "  1. cd $out"
echo "  2. verify builds:  (cd worklenz-backend && npm ci && npm run build)"
echo "                     (cd worklenz-frontend && npm ci && npm run build)"
echo "  3. grep -ri 'appsumo\\|directpay\\|ncinga' --include='*.md' .   # sanity"
echo "  4. git init && git add -A && git commit -m 'Open-core release' "
echo "  5. git remote add oss <public-repo-url> && git push --force oss main"
