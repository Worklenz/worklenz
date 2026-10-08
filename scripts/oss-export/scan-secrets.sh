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

# On a git checkout scan only tracked files (what could be published); elsewhere scan the tree.
scan() {
  local pattern="$1"
  if [ "$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null)" = "$(cd "$dir" && pwd)" ]; then
    git -C "$dir" ls-files -z | (cd "$dir" && xargs -0 grep -EnH --binary-files=without-match -e "$pattern" 2>/dev/null)
  else
    grep -rEn --binary-files=without-match \
      --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=build --exclude-dir=dist \
      -e "$pattern" "$dir" 2>/dev/null
  fi
}

status=0
for pattern in "${patterns[@]}"; do
  if hits=$(scan "$pattern"); then
    echo "possible secret matching /$pattern/:" >&2
    echo "$hits" | cut -c1-160 | sed 's/^/  /' >&2
    status=1
  fi
done

[ "$status" -eq 0 ] && echo "secret scan: clean ($dir)"
exit "$status"
