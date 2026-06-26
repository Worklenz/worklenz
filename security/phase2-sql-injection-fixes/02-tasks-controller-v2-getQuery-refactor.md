# tasks-controller-v2.ts - getQuery Method Refactoring

## Status: PARTIALLY COMPLETE

The filter methods have been updated to return `{ clause: string; params: string[] }`, but the `getQuery` method needs significant refactoring to properly collect and track parameters.

---

## ✅ Completed Changes

1. **Import SqlHelper** - Added to imports
2. **Filter methods updated:**
   - `getFilterByStatusWhereClosure()` - Now returns `{ clause, params }`
   - `getFilterByPriorityWhereClosure()` - Now returns `{ clause, params }`
   - `getFilterByLabelsWhereClosure()` - Now returns `{ clause, params }`
   - `getFilterByMembersWhereClosure()` - Now returns `{ clause, params }`
   - `getFilterByProjectsWhereClosure()` - Now returns `{ clause, params }`

---

## ⚠️ Required Changes in getQuery Method

The `getQuery` method (line ~192) needs these updates:

### Change 1: Initialize Parameter Tracking

**Add at the beginning of getQuery:**
```typescript
private static getQuery(userId: string, options: ParsedQs) {
  // PHASE 2: Initialize parameter collection
  const queryParams: any[] = [userId]; // $1 is always userId
  let paramOffset = 2; // Start at $2 (after userId)
  
  // ... rest of method
```

### Change 2: Update Filter Method Calls

**Current code (lines 272-290):**
```typescript
const statusesFilter = TasksControllerV2.getFilterByStatusWhereClosure(
  options.statuses as string
);
const labelsFilter = TasksControllerV2.getFilterByLabelsWhereClosure(
  options.labels as string
);
// ... etc
```

**Change to:**
```typescript
// Collect filter clauses and parameters
const statusesResult = TasksControllerV2.getFilterByStatusWhereClosure(
  options.statuses as string,
  paramOffset
);
if (statusesResult.params.length > 0) {
  queryParams.push(...statusesResult.params);
  paramOffset += statusesResult.params.length;
}

const labelsResult = TasksControllerV2.getFilterByLabelsWhereClosure(
  options.labels as string,
  paramOffset
);
if (labelsResult.params.length > 0) {
  queryParams.push(...labelsResult.params);
  paramOffset += labelsResult.params.length;
}

const membersResult = TasksControllerV2.getFilterByMembersWhereClosure(
  options.members as string,
  paramOffset
);
if (membersResult.params.length > 0) {
  queryParams.push(...membersResult.params);
  paramOffset += membersResult.params.length;
}

const projectsResult = TasksControllerV2.getFilterByProjectsWhereClosure(
  options.projects as string,
  paramOffset
);
if (projectsResult.params.length > 0) {
  queryParams.push(...projectsResult.params);
  paramOffset += projectsResult.params.length;
}

const priorityResult = TasksControllerV2.getFilterByPriorityWhereClosure(
  options.priorities as string,
  paramOffset
);
if (priorityResult.params.length > 0) {
  queryParams.push(...priorityResult.params);
  paramOffset += priorityResult.params.length;
}
```

### Change 3: Update Filter Array Construction

**Current code (lines 340-351):**
```typescript
const filters = [
  subTasksFilter,
  isSubTasks ? "1 = 1" : archivedFilter,
  isSubTasks ? "$1 = $1" : filterByAssignee,
  statusesFilter,
  priorityFilter,
  labelsFilter,
  membersFilter,
  projectsFilter,
]
  .filter((i) => !!i)
  .join(" AND ");
```

**Change to:**
```typescript
const filters = [
  subTasksFilter,
  isSubTasks ? "1 = 1" : archivedFilter,
  isSubTasks ? "$1 = $1" : filterByAssignee,
  statusesResult.clause,
  priorityResult.clause,
  labelsResult.clause,
  membersResult.clause,
  projectsResult.clause,
]
  .filter((i) => !!i)
  .join(" AND ");
```

### Change 4: Fix Subtask Filters (lines 364-379)

**Current code uses flatString() - REMOVE THESE:**
```typescript
// Apply priority filter to subtasks if present
if (options.priorities) {
  const priorityIds = this.flatString(options.priorities as string);
  subtaskFilters.push(`subtask.priority_id IN (${priorityIds})`);
}
```

**Change to:**
```typescript
// Apply priority filter to subtasks if present
if (options.priorities && priorityResult.clause) {
  // Reuse the same parameters - they're already in queryParams
  const priorityIds = (options.priorities as string).split(" ").filter(id => id.trim());
  const { clause: inClause } = SqlHelper.buildInClause(priorityIds, paramOffset - priorityResult.params.length);
  subtaskFilters.push(`subtask.priority_id IN (${inClause})`);
}

// Apply labels filter to subtasks if present
if (options.labels && labelsResult.clause) {
  const labelIds = (options.labels as string).split(" ").filter(id => id.trim());
  const { clause: inClause } = SqlHelper.buildInClause(labelIds, paramOffset - labelsResult.params.length);
  subtaskFilters.push(`subtask.id IN (SELECT task_id FROM task_labels WHERE label_id IN (${inClause}))`);
}

// Apply members filter to subtasks if present
if (options.members && membersResult.clause) {
  const memberIds = (options.members as string).split(" ").filter(id => id.trim());
  const { clause: inClause } = SqlHelper.buildInClause(memberIds, paramOffset - membersResult.params.length);
  subtaskFilters.push(`subtask.id IN (SELECT task_id FROM tasks_assignees WHERE team_member_id IN (${inClause}))`);
}
```

### Change 5: Fix Search Query (lines 255-268)

**Current code has SQL injection vulnerability:**
```typescript
enhancedSearchQuery = `AND (
  t.name ILIKE '%${searchTerm}%'
  OR CONCAT((SELECT key FROM projects WHERE id = t.project_id), '-', task_no) ILIKE '%${searchTerm}%'
  ...
)`;
```

**Change to:**
```typescript
const searchParam = `%${searchTerm}%`;
queryParams.push(searchParam);
const searchParamNum = paramOffset++;

enhancedSearchQuery = `AND (
  t.name ILIKE $${searchParamNum}
  OR CONCAT((SELECT key FROM projects WHERE id = t.project_id), '-', task_no) ILIKE $${searchParamNum}
  OR EXISTS (
    SELECT 1 FROM tasks subtask
    WHERE subtask.parent_task_id = t.id
    AND subtask.archived IS FALSE
    AND (
      subtask.name ILIKE $${searchParamNum}
      OR CONCAT((SELECT key FROM projects WHERE id = subtask.project_id), '-', subtask.task_no) ILIKE $${searchParamNum}
    )
  )
)`;
```

### Change 6: Fix Subtask Search (lines 386-389)

**Current code:**
```typescript
subtaskFilters.push(`(
  subtask.name ILIKE '%${searchTerm}%'
  OR CONCAT((SELECT key FROM projects WHERE id = subtask.project_id), '-', subtask.task_no) ILIKE '%${searchTerm}%'
)`);
```

**Change to:**
```typescript
// Reuse the same search parameter
const searchParamNum = paramOffset - 1; // The search param we just added
subtaskFilters.push(`(
  subtask.name ILIKE $${searchParamNum}
  OR CONCAT((SELECT key FROM projects WHERE id = subtask.project_id), '-', subtask.task_no) ILIKE $${searchParamNum}
)`);
```

### Change 7: Fix statusesFilter.replace() Error (line 361)

**Current code:**
```typescript
if (statusesFilter) {
  subtaskFilters.push(statusesFilter.replace(/\bt\./g, 'subtask.'));
}
```

**Change to:**
```typescript
if (statusesResult.clause) {
  subtaskFilters.push(statusesResult.clause.replace(/\bt\./g, 'subtask.'));
}
```

### Change 8: Return Parameters with Query

**At the end of getQuery method, change return statement:**

**Current:**
```typescript
return { query: q, isSubTasks };
```

**Change to:**
```typescript
return { query: q, params: queryParams, isSubTasks };
```

### Change 9: Update Method Signature

**Current:**
```typescript
private static getQuery(userId: string, options: ParsedQs) {
```

**Change to:**
```typescript
private static getQuery(userId: string, options: ParsedQs): { query: string; params: any[]; isSubTasks: boolean } {
```

---

## 🔧 Calling Code Updates

All places that call `getQuery` need to be updated to pass parameters to `db.query()`:

**Find all instances like:**
```typescript
const { query } = TasksControllerV2.getQuery(userId, req.query);
const result = await db.query(query, [userId]);
```

**Change to:**
```typescript
const { query, params } = TasksControllerV2.getQuery(userId, req.query);
const result = await db.query(query, params);
```

---

## 📊 Complexity Analysis

This refactoring is complex because:

1. **Parameter offset tracking** - Must track position of each parameter
2. **Multiple filter combinations** - Each filter adds variable number of parameters
3. **Parameter reuse** - Subtask filters reuse main filter parameters
4. **Search parameter** - Needs to be added and tracked separately
5. **Calling code** - Multiple methods call `getQuery` and need updates

**Estimated effort:** 2-3 hours to complete and test thoroughly

---

## ✅ Testing Checklist

After completing refactoring:

- [ ] Test with no filters
- [ ] Test with single status filter
- [ ] Test with multiple filters (status + priority + labels)
- [ ] Test with search term
- [ ] Test with subtasks
- [ ] Test with all filters combined
- [ ] Verify no SQL injection possible
- [ ] Check parameter count matches placeholders
- [ ] Verify performance is acceptable

---

## 🎯 Alternative Approach

Given the complexity, consider:

1. **Complete this file in a dedicated session** - Focus only on tasks-controller-v2.ts
2. **Create unit tests first** - Test SqlHelper thoroughly
3. **Incremental deployment** - Deploy filter fixes one at a time
4. **Code review** - Have another developer review parameter tracking

---

## 📝 Notes

- The filter methods are already fixed (✅ complete)
- The main challenge is updating `getQuery` to collect parameters properly
- This pattern will be similar for other controllers
- Once this is complete, other controllers will be easier (they're simpler)

---

**Status:** Filter methods complete, getQuery refactoring in progress  
**Next Step:** Complete getQuery refactoring or move to simpler controller first
