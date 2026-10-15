#!/usr/bin/env bash
# Fail if a directory tree contains key-shaped strings. Run by build-oss-tree.sh on the export
# output, and usable on its own:  scan-secrets.sh [DIR]   (default: current directory)
#
# The public repo is published as a single squashed commit, so the tree is all that leaks. This
# is a last line of defence, not a replacement for keeping secrets in env files.
set -euo pipefail

dir="${1:-.}"

patterns=(
  'pdl_(live|sdbx)_apikey_[A-Za-z0-9]{10,}'                 # Paddle Billing API key
  'pdl_ntfset_[A-Za-z0-9+/=_-]{10,}'                        # Paddle webhook destination secret
  '(VENDOR_AUTH_CODE|vendor_auth_code)["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"'][0-9a-f]{20,}["'"'"']'  # Paddle Classic auth code
  '-----BEGIN ([A-Z]+ )?PRIVATE KEY-----'
  'AKIA[0-9A-Z]{16}'                                        # AWS access key id
  'xox[abpr]-[0-9A-Za-z-]{10,}'                             # Slack token
  'KEYGEN_ADMIN_TOKEN[[:space:]]*=[[:space:]]*[A-Za-z0-9._-]{12,}'
)

# Materialize the file list first so a failed git/find command cannot look like a clean scan.
file_list=$(mktemp)
trap 'rm -f "$file_list"' EXIT
if ! dir=$(cd "$dir" && pwd); then
  echo "secret scan: cannot access input directory" >&2
  exit 2
fi
if [ "$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null)" = "$dir" ]; then
  if ! git -C "$dir" ls-files -z > "$file_list"; then
    echo "secret scan: could not list tracked files" >&2
    exit 2
  fi
  cd "$dir"
else
  if ! find "$dir" -type d \( -name node_modules -o -name .git -o -name build -o -name dist \) -prune     -o -type f -print0 > "$file_list"; then
    echo "secret scan: could not list input files" >&2
    exit 2
  fi
fi

scan() {
  # grep exits 1 for no matches; only errors (>1) fail the batch. NUL-delimited filenames
  # let the formatter discard matched content without confusing colons in paths or values.
  xargs -0 -r bash -c '
    grep -EnHZ --binary-files=without-match -e "$1" -- "${@:2}"
    result=$?
    if [ "$result" -gt 1 ]; then exit "$result"; fi
    exit 0
  ' _ "$1" < "$file_list" | while IFS= read -r -d '' file && IFS= read -r match; do
    printf '%s:%s\n' "$file" "${match%%:*}"
  done
}

status=0
for pattern in "${patterns[@]}"; do
  if hits=$(scan "$pattern"); then
    if [ -n "$hits" ]; then
      echo "possible secret matching /$pattern/:" >&2
      printf '%s\n' "$hits" >&2
      status=1
    fi
  else
    echo "secret scan: failed while scanning files" >&2
    exit 2
  fi
done

[ "$status" -eq 0 ] && echo "secret scan: clean ($dir)"
exit "$status"
