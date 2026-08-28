# OSS export

Tooling to produce the public (open-source) tree from this private repo.

The public repo is published as a **single squashed commit with no prior
history**, so this is a file-copy operation, not a git-history rewrite.

## Files

| File | Purpose |
|---|---|
| `exclude.txt` | git pathspecs to drop from the public tree |
| `allow.txt`   | files to keep despite a broader `exclude.txt` rule |
| `build-oss-tree.sh` | materialise the clean tree into a directory |

## Usage

```bash
scripts/oss-export/build-oss-tree.sh [OUTPUT_DIR]   # default: ../worklenz-oss-export
```

It prints the full list of excluded paths, asks for confirmation, then writes
the tree. It never pushes and never modifies this repo.

After it runs, from the output directory:

1. `cd worklenz-backend && npm ci && npm run build`
2. `cd worklenz-frontend && npm ci && npm run build`
3. `grep -ri 'appsumo\|directpay\|ncinga' --include='*.md' .` — sanity check
4. `git init && git add -A && git commit -m "..."`
5. push to the public remote

## What is excluded, and why it's safe

| Excluded | Why safe to omit |
|---|---|
| `worklenz-backend/src/private/` | Loaded optionally via `shared/private-extensions.ts` — falls back to no-ops when absent. |
| `database/migrations-private/`, `database/pg-migrations-private/` | `scripts/migrate.js` skips these dirs when they don't exist. |
| DirectPay / AppSumo strategy docs, licensing proposal, security remediation plan | Internal only. |
| `docs/`, `worklenz-backend/docs/`, `worklenz-backend/doc/` | Internal engineering notes and feature specs. Allowlist rescues `docs/SELF_HOSTING.md`. |
| `.github/workflows/azure-static-web-apps-*.yml` | CI wired to our Azure infra and a client branch. |
| `.cursorrules`, `.windsurfrules`, `.coderabbit.yaml`, `.claude/` | Our editor / assistant config. |

## What is deliberately NOT excluded

`worklenz-frontend/src/components/appsumo-popup/`,
`worklenz-frontend/src/config/appsumo-promo.config.ts`,
`worklenz-frontend/src/ee/hooks/useAppSumoTracking.ts` — promo UI plus a
Mixpanel wrapper, nothing sensitive, and ~15 core components import them.
Removing them cleanly needs the core↔ee decoupling add-on, not a file delete.
