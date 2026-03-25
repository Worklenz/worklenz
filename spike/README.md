# PPM TaskFlow — Kill-Shot Spike (Phase 1)

## Purpose
Prove 5 core assumptions before committing to the full 3-layer build.
**GO/NO-GO criteria:** If all 5 work without touching >5 Worklenz core files → proceed to Phase 2.

## Spike Results

| # | Spike | Status | Core Files Touched |
|---|-------|--------|--------------------|
| 1b | RLS client isolation | READY TO TEST | 0 |
| 1c | LISTEN/NOTIFY routing | READY TO TEST | 0 |
| 1d | Magic link auth | READY TO TEST | 0 |
| 1e | API-writable tasks | READY TO TEST | 0 |
| 1f | 15-min time tracking | ANALYZED — PASS | 0 |

**Total Worklenz core files modified: 0** — all spike code lives in `ppm_` tables/functions and new files.

## Files

- `001_rls_client_isolation.sql` — RLS policies + test data + verification queries
- `002_listen_notify_routing.sql` — NOTIFY function + trigger on ppm_deliverables + routing log
- `003_magic_link_auth.sql` — Magic link generate/validate functions
- `004_time_tracking_analysis.md` — Analysis of Worklenz time tracking + PPM extension plan
- `005_api_writable_tasks.ts` — PPM wrapper endpoint for task + deliverable creation
- `spike_test.sql` — End-to-end verification script (run all spikes)

## How to Run

### Prerequisites
- PostgreSQL 14+ instance
- Worklenz database initialized (or standalone for spike-only testing)

### Run all spike migrations
```bash
psql -d worklenz -f spike/001_rls_client_isolation.sql
psql -d worklenz -f spike/002_listen_notify_routing.sql
psql -d worklenz -f spike/003_magic_link_auth.sql
psql -d worklenz -f spike/spike_test.sql
```

## Architecture Decision
All PPM code follows the soft-fork convention:
- Database: `ppm_` prefixed tables, functions, triggers
- Backend: `src/ppm/` directory
- Frontend: `src/components/ppm/` directory
- Config: `PPM_` prefixed env vars

This keeps upstream merges clean and makes the fork's delta obvious.
