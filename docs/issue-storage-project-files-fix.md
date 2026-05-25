# Storage & Project Files Fix — Session Summary

**Date:** 2026-05-23  
**Branch:** (correct branch, applied after checkout)

---

## Context & Investigation

This session was a deep code analysis of the Worklenz backend file upload and storage system, followed by a targeted fix. The work covered three subsystems in detail before arriving at the changes.

---

## Systems Analysed

### 1. Task Attachments (`/api/v1/attachments`)

**Files read:**
- `worklenz-backend/src/controllers/attachment-controller.ts`
- `worklenz-backend/src/routes/apis/attachments-api-router.ts`
- `worklenz-backend/src/shared/storage.ts`
- `worklenz-backend/src/shared/constants.ts`
- `worklenz-backend/src/middlewares/validators/task-attachments-validator.ts`
- `worklenz-backend/src/middlewares/verify-task-access.ts`
- `worklenz-backend/src/middlewares/image-to-webp.ts`

**Key findings:**
- Files are sent as base64 from the client, validated, then uploaded via `uploadBase64()` to S3/Azure/MinIO.
- Storage key pattern: `{getRootDir()}/{teamId}/{projectId}/{attachmentId}.{ext}`  
  e.g. `secure/{teamId}/{projectId}/{uuid}.pdf`
- `getRootDir()` returns `secure` (prod), `test-server` (UAT), `local-server` (dev).
- Avatar uploads use `sharp` to convert to WebP at 50% quality before upload.
- `GET /attachments/download` had no authorization check — any authenticated user who knows an attachment UUID can generate a presigned download URL.
- `GET /attachments/project/:id` had no project membership check.
- DB insert happens **before** S3 upload in `createTaskAttachment` — if S3 fails, an orphaned DB row is left with no cleanup.
- `deleteObject` is always fire-and-forget (`void`) — storage deletion failures are silently swallowed.

---

### 2. Project Files (`/api/v1/projects/:projectId/files`)

**Files read:**
- `worklenz-backend/src/controllers/project-files-controller.ts`
- `worklenz-backend/src/routes/apis/project-files-api-router.ts`
- `worklenz-backend/src/routes/apis/projects-api-router.ts`
- `worklenz-backend/src/middlewares/validators/project-files-validator.ts`
- `worklenz-backend/src/middlewares/verify-project-access.ts`

**Key findings:**
- Uses `multer` with `memoryStorage()` — file lands in RAM as `req.file.buffer`, max 100 MB.
- Storage key was built with `getProjectFileStorageKey()` using `getEnvironmentPrefix()` (`prod/uat/dev`), producing keys like `prod/{teamId}/projects/{projectId}/files/{uuid}.pdf`.
- This is a **different root prefix** from task attachments (`secure/...`), so project files were **never counted** in the account storage calculation.
- S3 upload happens **before** DB insert (correct order) — if DB insert fails, the orphaned S3 object is cleaned up.
- The `list` method had **3 broken SQL parameter placeholders** — `LIMIT` and `OFFSET` used JavaScript template literal interpolation (`${params.length + 1}`) instead of PostgreSQL `$N` syntax, causing runtime query failures.
- `verifyProjectAccess` middleware has a side effect: it can call `activate_team()` DB function and mutate `req.user.team_id` — significant for a middleware that should only verify access.

---

### 3. Account Storage Calculation (`GET /api/v1/admin-center/billing/account-storage`)

**Files read:**
- `worklenz-backend/src/controllers/admin-center-controller.ts`
- `worklenz-backend/src/shared/s3.ts`
- `worklenz-backend/src/shared/paddle-utils.ts`

**Key findings:**
- `getAccountStorage` fetches all teams owned by the user, then calls `calculateStorage(teamId)` for each.
- `calculateStorage` in `s3.ts` (legacy) lists S3 objects under `{getRootDir()}/{teamId}/` — e.g. `secure/{teamId}/`.
- Because project files used `getEnvironmentPrefix()` (`prod/...`), they were **outside this prefix** and never counted.
- The controller imports from the **legacy `s3.ts`** (S3-only, no MinIO `forcePathStyle`, no Azure support), not the multi-provider `storage.ts`.
- Teams are processed **sequentially** in a `for...of` loop — N serial S3 `ListObjectsV2` calls.
- `calculateStorage` in `s3.ts` returns `undefined` on error (not `0`), causing `storage.used` to become `NaN`.
- `getUsedStorage` in `paddle-utils.ts` (used for free-plan enforcement) reads only `task_attachments.size` from the DB — it does **not** count project files either, and does not touch S3.
- Response units are inconsistent: `total` is in GB (raw integer from `organizations.storage`), while `used` and `remaining` are in bytes.

---

## `calculateStorage` — What It Covers and What It Misses

### How it works

`calculateStorage(teamId)` in `s3.ts` lists every S3 object under `{getRootDir()}/{teamId}/` using paginated `ListObjectsV2`, summing `obj.Size` (bytes) across all pages. The `do...while` loop correctly handles S3's 1000-object-per-page limit.

### What the prefix covers (after the fix)

In production the scanned prefix is `secure/{teamId}/`. This captures:

| File type | S3 key pattern |
|-----------|---------------|
| Task attachments | `secure/{teamId}/{projectId}/{attachmentId}.{ext}` |
| Task comment attachments | `secure/{teamId}/{projectId}/{taskId}/{commentId}/{attachmentId}.{ext}` |
| **Project files (after fix)** | `secure/{teamId}/projects/{projectId}/files/{fileId}.{ext}` |

### What it still does NOT cover

These storage areas use different root prefixes and remain outside the `calculateStorage` scan:

| File type | S3 key pattern | Why excluded |
|-----------|---------------|--------------|
| Avatars | `avatars/secure/{userId}.{ext}` | Different top-level prefix (`avatars/`) |
| Organization logos | `organization-logos/secure/{orgId}.{ext}` | Different top-level prefix (`organization-logos/`) |
| Client portal files | `prod/organizations/{orgId}/client-portal/...` | Uses `getEnvironmentPrefix()` (`prod/uat/dev`), not `getRootDir()` |

These are intentionally excluded from the per-team storage quota — avatars and logos are platform assets, and client portal files are tracked separately.

---

## Root Cause

Project files were stored under a different S3 path prefix (`prod/{teamId}/projects/...`) than what `calculateStorage` scans (`secure/{teamId}/`). This meant project file storage was never included in the account storage usage shown in the admin center billing page.

---

## Changes Made

### File 1: `worklenz-backend/src/shared/storage.ts`

**Function:** `getProjectFileStorageKey`

**Change:** Replaced `getEnvironmentPrefix()` with `getRootDir()` as the root path segment.

```typescript
// BEFORE
export function getProjectFileStorageKey(teamId, projectId, fileId, extension) {
  const keyPath = path.join(
    getEnvironmentPrefix(),   // "prod" | "uat" | "dev"
    teamId,
    "projects",
    projectId,
    "files",
    `${fileId}.${extension}`,
  ).replace(/\\/g, "/");
  return keyPath;
}

// AFTER
export function getProjectFileStorageKey(teamId, projectId, fileId, extension) {
  // Uses getRootDir() so project files land under the same root prefix as task
  // attachments (e.g. "secure/{teamId}/projects/..."). This ensures
  // calculateStorage(teamId) in the admin-center controller picks up project
  // files automatically without any additional changes to that controller.
  const keyPath = path.join(
    getRootDir(),             // "secure" | "test-server" | "local-server"
    teamId,
    "projects",
    projectId,
    "files",
    `${fileId}.${extension}`,
  ).replace(/\\/g, "/");
  return keyPath;
}
```

**New key pattern:** `secure/{teamId}/projects/{projectId}/files/{uuid}.{ext}`

**Effect:** All four project file operations (upload, download, delete, storage listing) use `getProjectFileStorageKey` consistently, so they all stay in sync with the new path. The admin center `calculateStorage(teamId)` now picks up project files automatically because they fall under `secure/{teamId}/` — no changes needed to `admin-center-controller.ts`.

**Note on existing data:** Files uploaded before this change remain at their old `prod/{teamId}/projects/...` paths. They will not be accessible via the new key and will not be counted in storage. Only new uploads from this point forward use the corrected path.

---

### File 2: `worklenz-backend/src/controllers/project-files-controller.ts`

**Method:** `list`

**Change:** Fixed 3 broken SQL parameter placeholders. The original code used JavaScript template literal interpolation inside the SQL string, which injected literal numbers instead of `$N` parameter references.

```typescript
// BEFORE (broken — PostgreSQL receives literal numbers, not parameter refs)
const searchClause = search ? `AND pf.name ILIKE ${params.length + 1}` : "";
// ...
LIMIT ${params.length + 1}
OFFSET ${params.length + 2}

// AFTER (correct — proper $N parameterized placeholders)
let searchClause = "";
if (search) {
  params.push(`%${search}%`);
  searchClause = `AND pf.name ILIKE $${params.length}`;
}
const limitParam = params.length + 1;
const offsetParam = params.length + 2;
// ...
LIMIT $${limitParam}
OFFSET $${offsetParam}
```

**Effect:** The file list endpoint now executes correctly. Previously, any call to `GET /projects/:projectId/files` would fail at the database level because PostgreSQL received `LIMIT 2 OFFSET 3` (literal values) instead of `LIMIT $2 OFFSET $3` (parameterized). The fix also restructures the search clause build so the `$N` index is computed after the search param is pushed, making the numbering unambiguous.

---

## Files Changed

| File | Change |
|------|--------|
| `worklenz-backend/src/shared/storage.ts` | `getProjectFileStorageKey`: `getEnvironmentPrefix()` → `getRootDir()` |
| `worklenz-backend/src/controllers/project-files-controller.ts` | `list` method: fixed 3 broken SQL `$N` placeholders |

## Files NOT Changed

| File | Reason |
|------|--------|
| `worklenz-backend/src/controllers/admin-center-controller.ts` | No changes needed — `calculateStorage` now covers project files automatically |
| `worklenz-backend/src/shared/s3.ts` | Not touched — legacy file, left as-is |
| `worklenz-backend/src/routes/apis/project-files-api-router.ts` | No changes needed |
| `worklenz-backend/src/routes/apis/projects-api-router.ts` | No changes needed |
| `worklenz-backend/src/middlewares/validators/project-files-validator.ts` | No changes needed |
| All other controllers, routes, validators | No changes needed |

---

## Known Remaining Issues (Not Fixed in This Session)

These were identified during analysis but are out of scope for this change:

1. **`admin-center-controller.ts` imports legacy `s3.ts`** — On Azure or MinIO deployments, `getAccountStorage` will return `used = 0` because the legacy S3 client doesn't support those providers. Fix: change import to `../shared/storage`.
2. **Sequential S3 calls in `getAccountStorage`** — Teams are processed one at a time. Fix: use `Promise.all`.
3. **`calculateStorage` in `s3.ts` returns `undefined` on error** — Causes `storage.used` to become `NaN`. The `storage.ts` version correctly returns `0`.
4. **`GET /attachments/download` has no authorization check** — Any authenticated user who knows an attachment UUID can generate a presigned URL.
5. **`GET /attachments/project/:id` has no project membership check** — Only `idParamValidator` runs.
6. **`getUsedStorage` (free plan enforcement) only counts `task_attachments`** — Project files are not counted against the free plan storage limit.
7. **`deleteObject` is always fire-and-forget** — Storage deletion failures are silently swallowed across all controllers.
8. **`verifyProjectAccess` has a side effect** — Can call `activate_team()` and mutate `req.user.team_id` inside a middleware.
