# Phase 2: SQL Injection Fixes - Migration Guide

## Overview

This guide explains how to migrate from unsafe SQL string interpolation to secure parameterized queries across the Worklenz backend.

---

## 🎯 Affected Files

Based on code analysis, the following files need updates:

### Critical Priority (Direct SQL Injection)
- ✅ `socket.io/commands/on-task-timer-stop.ts` - **FIXED**
- ⏳ `controllers/tasks-controller-v2.ts` - 11 instances of flatString()
- ⏳ `controllers/projects-controller.ts` - 4 instances
- ⏳ `controllers/reporting/reporting-members-controller.ts` - 2 instances
- ⏳ `controllers/reporting/projects/reporting-projects-controller.ts` - 8 instances
- ⏳ `controllers/schedule/schedule-controller.ts` - 3 instances
- ⏳ `controllers/project-workload/workload-gannt-controller.ts` - 3 instances
- ⏳ `controllers/project-templates/pt-tasks-controller.ts` - 2 instances
- ⏳ `controllers/project-categories-controller.ts` - 1 instance

### Total Vulnerable Locations
- **1 critical fix completed** (on-task-timer-stop.ts)
- **~35 flatString() usages remaining**
- **Estimated effort:** 2-3 days for complete migration

---

## 📚 Pattern 1: Direct String Interpolation

### ❌ UNSAFE (Before)

```typescript
const userId = req.user.id;
const taskId = req.body.task_id;

const query = `
  SELECT * FROM tasks 
  WHERE user_id = '${userId}' 
  AND task_id = '${taskId}'
`;

await db.query(query, []);
```

### ✅ SECURE (After)

```typescript
const userId = req.user.id;
const taskId = req.body.task_id;

const query = `
  SELECT * FROM tasks 
  WHERE user_id = $1 
  AND task_id = $2
`;

await db.query(query, [userId, taskId]);
```

### 🔑 Key Changes
1. Replace `'${variable}'` with `$1`, `$2`, etc.
2. Pass variables in array as second parameter to `db.query()`
3. PostgreSQL handles escaping automatically

---

## 📚 Pattern 2: flatString() for IN Clauses

### ❌ UNSAFE (Before)

```typescript
private static flatString(text: string) {
  return (text || "")
    .split(" ")
    .map((s) => `'${s}'`)
    .join(",");
}

private static getFilterByStatusWhereClosure(text: string) {
  return text ? `status_id IN (${this.flatString(text)})` : "";
}

// Usage
const statusFilter = this.getFilterByStatusWhereClosure(req.query.statuses);
const query = `SELECT * FROM tasks WHERE ${statusFilter}`;
await db.query(query, []);
```

### ✅ SECURE (After)

```typescript
import { SqlHelper } from "../shared/sql-helpers";

private static getFilterByStatusWhereClosure(
  text: string,
  paramOffset: number = 1
): { clause: string; params: string[] } {
  if (!text) return { clause: "", params: [] };

  const statusIds = text.split(" ").filter(id => id.trim());
  const { clause, params } = SqlHelper.buildInClause(statusIds, paramOffset);
  
  return {
    clause: `status_id IN (${clause})`,
    params,
  };
}

// Usage
const params: any[] = [];
let paramOffset = 1;

const { clause: statusClause, params: statusParams } = 
  this.getFilterByStatusWhereClosure(req.query.statuses, paramOffset);

if (statusClause) {
  params.push(...statusParams);
  paramOffset += statusParams.length;
}

const query = `SELECT * FROM tasks WHERE ${statusClause}`;
await db.query(query, params);
```

### 🔑 Key Changes
1. Import `SqlHelper` from `shared/sql-helpers`
2. Change filter methods to return `{ clause: string; params: any[] }`
3. Add `paramOffset` parameter to track parameter positions
4. Use `SqlHelper.buildInClause()` instead of `flatString()`
5. Collect all parameters in an array
6. Track parameter offset for multiple filters

---

## 📚 Pattern 3: Multiple Filters

### ❌ UNSAFE (Before)

```typescript
const statusFilter = req.query.statuses 
  ? `status_id IN (${this.flatString(req.query.statuses)})` 
  : "";
  
const priorityFilter = req.query.priorities 
  ? `priority_id IN (${this.flatString(req.query.priorities)})` 
  : "";

const whereClauses = [statusFilter, priorityFilter].filter(Boolean);
const whereClause = whereClauses.length > 0 
  ? `WHERE ${whereClauses.join(" AND ")}` 
  : "";

const query = `SELECT * FROM tasks ${whereClause}`;
await db.query(query, []);
```

### ✅ SECURE (After)

```typescript
const params: any[] = [];
const whereClauses: string[] = [];
let paramOffset = 1;

// Status filter
if (req.query.statuses) {
  const statusIds = (req.query.statuses as string).split(" ");
  const { clause, params: statusParams } = SqlHelper.buildInClause(statusIds, paramOffset);
  whereClauses.push(`status_id IN (${clause})`);
  params.push(...statusParams);
  paramOffset += statusParams.length;
}

// Priority filter
if (req.query.priorities) {
  const priorityIds = (req.query.priorities as string).split(" ");
  const { clause, params: priorityParams } = SqlHelper.buildInClause(priorityIds, paramOffset);
  whereClauses.push(`priority_id IN (${clause})`);
  params.push(...priorityParams);
  paramOffset += priorityParams.length;
}

const whereClause = whereClauses.length > 0 
  ? `WHERE ${whereClauses.join(" AND ")}` 
  : "";

const query = `SELECT * FROM tasks ${whereClause}`;
await db.query(query, params);
```

### 🔑 Key Changes
1. Initialize `params` array and `paramOffset` counter
2. Build each filter separately
3. Collect parameters from each filter
4. Increment `paramOffset` after each filter
5. Pass collected `params` to `db.query()`

---

## 📚 Pattern 4: Complex Queries with Subqueries

### ❌ UNSAFE (Before)

```typescript
const memberIds = this.flatString(req.query.members);
const query = `
  SELECT * FROM tasks
  WHERE id IN (
    SELECT task_id FROM tasks_assignees 
    WHERE team_member_id IN (${memberIds})
  )
  OR EXISTS (
    SELECT 1 FROM tasks subtask
    JOIN tasks_assignees ta ON ta.task_id = subtask.id
    WHERE subtask.parent_task_id = tasks.id
    AND ta.team_member_id IN (${memberIds})
  )
`;
```

### ✅ SECURE (After)

```typescript
const memberIds = (req.query.members as string).split(" ");
const { clause: inClause1, params } = SqlHelper.buildInClause(memberIds, 1);
const { clause: inClause2 } = SqlHelper.buildInClause(memberIds, 1);

const query = `
  SELECT * FROM tasks
  WHERE id IN (
    SELECT task_id FROM tasks_assignees 
    WHERE team_member_id IN (${inClause1})
  )
  OR EXISTS (
    SELECT 1 FROM tasks subtask
    JOIN tasks_assignees ta ON ta.task_id = subtask.id
    WHERE subtask.parent_task_id = tasks.id
    AND ta.team_member_id IN (${inClause2})
  )
`;

await db.query(query, params);
```

### 🔑 Key Changes
1. Use same parameter values for multiple IN clauses
2. Both IN clauses reference the same parameter positions
3. Only pass parameters once (they're reused)

---

## 🔧 Step-by-Step Migration Process

### Step 1: Import SqlHelper

```typescript
import { SqlHelper } from "../shared/sql-helpers";
```

### Step 2: Update Filter Methods

Change from:
```typescript
private static getFilterByStatusWhereClosure(text: string) {
  return text ? `status_id IN (${this.flatString(text)})` : "";
}
```

To:
```typescript
private static getFilterByStatusWhereClosure(
  text: string,
  paramOffset: number = 1
): { clause: string; params: string[] } {
  if (!text) return { clause: "", params: [] };
  
  const statusIds = text.split(" ").filter(id => id.trim());
  const { clause, params } = SqlHelper.buildInClause(statusIds, paramOffset);
  
  return {
    clause: `status_id IN (${clause})`,
    params,
  };
}
```

### Step 3: Update Query Building Code

Change from:
```typescript
const statusFilter = this.getFilterByStatusWhereClosure(req.query.statuses);
const query = `SELECT * FROM tasks WHERE ${statusFilter}`;
await db.query(query, []);
```

To:
```typescript
const params: any[] = [];
let paramOffset = 1;

const { clause: statusFilter, params: statusParams } = 
  this.getFilterByStatusWhereClosure(req.query.statuses, paramOffset);

if (statusFilter) {
  params.push(...statusParams);
  paramOffset += statusParams.length;
}

const query = `SELECT * FROM tasks WHERE ${statusFilter}`;
await db.query(query, params);
```

### Step 4: Remove flatString() Method

Delete the unsafe `flatString()` method entirely:
```typescript
// DELETE THIS:
private static flatString(text: string) {
  return (text || "")
    .split(" ")
    .map((s) => `'${s}'`)
    .join(",");
}
```

### Step 5: Test Thoroughly

```typescript
// Test with various inputs
const testCases = [
  { statuses: "status1 status2" },
  { statuses: "status1" },
  { statuses: "" },
  { statuses: "status1 status2 status3 status4" },
];

for (const testCase of testCases) {
  const { clause, params } = this.getFilterByStatusWhereClosure(testCase.statuses);
  console.log("Clause:", clause);
  console.log("Params:", params);
}
```

---

## ✅ Testing Checklist

For each migrated file:

- [ ] All `flatString()` calls removed
- [ ] All filter methods return `{ clause, params }`
- [ ] Parameter offsets tracked correctly
- [ ] All parameters collected in array
- [ ] `db.query()` receives parameters array
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing with various filter combinations
- [ ] SQL injection attempts blocked
- [ ] Performance is acceptable

---

## 🚨 Common Pitfalls

### Pitfall 1: Forgetting to Increment paramOffset

❌ **Wrong:**
```typescript
const { clause: clause1, params: params1 } = SqlHelper.buildInClause(ids1, 1);
const { clause: clause2, params: params2 } = SqlHelper.buildInClause(ids2, 1); // WRONG!
```

✅ **Correct:**
```typescript
const { clause: clause1, params: params1 } = SqlHelper.buildInClause(ids1, 1);
const { clause: clause2, params: params2 } = SqlHelper.buildInClause(ids2, 1 + params1.length);
```

### Pitfall 2: Not Collecting All Parameters

❌ **Wrong:**
```typescript
const { clause, params } = SqlHelper.buildInClause(ids, 1);
await db.query(`SELECT * FROM tasks WHERE id IN (${clause})`, []); // WRONG!
```

✅ **Correct:**
```typescript
const { clause, params } = SqlHelper.buildInClause(ids, 1);
await db.query(`SELECT * FROM tasks WHERE id IN (${clause})`, params);
```

### Pitfall 3: Mixing String Interpolation with Parameters

❌ **Wrong:**
```typescript
const userId = req.user.id;
const { clause, params } = SqlHelper.buildInClause(taskIds, 1);
const query = `SELECT * FROM tasks WHERE user_id = '${userId}' AND id IN (${clause})`;
await db.query(query, params); // WRONG! userId is not parameterized
```

✅ **Correct:**
```typescript
const userId = req.user.id;
const { clause, params: taskParams } = SqlHelper.buildInClause(taskIds, 2);
const query = `SELECT * FROM tasks WHERE user_id = $1 AND id IN (${clause})`;
await db.query(query, [userId, ...taskParams]);
```

---

## 📊 Progress Tracking

| File | flatString() Count | Status | Priority |
|------|-------------------|--------|----------|
| on-task-timer-stop.ts | 0 | ✅ Complete | Critical |
| tasks-controller-v2.ts | 11 | ⏳ Pending | High |
| projects-controller.ts | 4 | ⏳ Pending | High |
| reporting-members-controller.ts | 2 | ⏳ Pending | High |
| reporting-projects-controller.ts | 8 | ⏳ Pending | High |
| schedule-controller.ts | 3 | ⏳ Pending | Medium |
| workload-gannt-controller.ts | 3 | ⏳ Pending | Medium |
| pt-tasks-controller.ts | 2 | ⏳ Pending | Medium |
| project-categories-controller.ts | 1 | ⏳ Pending | Low |

---

## 🎯 Next Steps

1. **Review example fix:** `01-tasks-controller-v2-example.ts`
2. **Start with high-priority files:** tasks-controller-v2.ts
3. **Follow migration pattern:** One file at a time
4. **Test after each file:** Ensure no regressions
5. **Update Phase 1 middleware:** Remove after Phase 2 complete

---

## 📞 Questions?

If you encounter issues during migration:
1. Review the example file: `01-tasks-controller-v2-example.ts`
2. Check SqlHelper documentation: `src/shared/sql-helpers.ts`
3. Test with SQL injection payloads to verify fixes
4. Monitor application logs for errors

---

**Document Version:** 1.0  
**Created:** 2025-12-28  
**Status:** Phase 2 In Progress
