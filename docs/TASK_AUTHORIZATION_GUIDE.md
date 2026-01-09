# Task Authorization Guide for Developers

## 🎯 Quick Reference

When creating new endpoints that interact with tasks, **ALWAYS** add authorization middleware to prevent IDOR vulnerabilities.

## 📦 Import the Middleware

```typescript
import verifyTaskAccess, {
  verifyTaskAccessViaComment,
  verifyTaskAccessViaWorkLog,
  verifyTaskAccessViaDependency,
  verifyBulkTaskAccessMiddleware
} from "../../middlewares/verify-task-access";
```

## 🔧 Usage Examples

### 1. Task ID in URL Parameters

When the task ID is in the URL (e.g., `/tasks/:id`):

```typescript
tasksApiRouter.delete(
  "/:id", 
  verifyTaskAccess('params', 'id'),  // Add this middleware
  safeControllerFunction(TasksController.deleteById)
);

tasksApiRouter.put(
  "/:id", 
  idParamValidator,
  tasksBodyValidator, 
  verifyTaskAccess('params', 'id'),  // Add this middleware
  safeControllerFunction(TasksController.update)
);
```

### 2. Task ID in Request Body

When the task ID is in the request body:

```typescript
taskCommentsApiRouter.post(
  "/", 
  taskCommentBodyValidator, 
  verifyTaskAccess('body', 'task_id'),  // Add this middleware
  safeControllerFunction(TaskCommentsController.create)
);

attachmentsApiRouter.post(
  "/tasks", 
  taskAttachmentsValidator, 
  verifyTaskAccess('body', 'task_id'),  // Add this middleware
  safeControllerFunction(AttachmentController.createTaskAttachment)
);
```

### 3. Task ID in Query Parameters

When the task ID is in the query string:

```typescript
someApiRouter.get(
  "/endpoint", 
  verifyTaskAccess('query', 'task_id'),  // Add this middleware
  safeControllerFunction(SomeController.someMethod)
);
```

### 4. Custom Field Names

If your task ID field has a different name (e.g., `parent_task_id`):

```typescript
someApiRouter.post(
  "/endpoint", 
  verifyTaskAccess('body', 'parent_task_id'),  // Specify field name
  safeControllerFunction(SomeController.someMethod)
);
```

### 5. Comment/Work Log/Dependency Operations

When operating on comments, work logs, or dependencies (not direct task IDs):

```typescript
// For comment operations
taskCommentsApiRouter.put(
  "/:id", 
  verifyTaskAccessViaComment('params', 'id'),  // Use comment middleware
  safeControllerFunction(TaskCommentsController.update)
);

// For work log operations
taskWorkLogApiRouter.put(
  "/:id", 
  verifyTaskAccessViaWorkLog('params', 'id'),  // Use work log middleware
  safeControllerFunction(TaskWorklogController.update)
);

// For dependency operations
taskDependenciesApiRouter.delete(
  "/:id", 
  verifyTaskAccessViaDependency('params', 'id'),  // Use dependency middleware
  TaskdependenciesController.deleteById
);
```

### 6. Bulk Operations

When dealing with multiple tasks:

```typescript
tasksApiRouter.put(
  "/bulk/delete", 
  verifyBulkTaskAccessMiddleware(),  // Add bulk middleware BEFORE mapTasksToBulkUpdate
  mapTasksToBulkUpdate, 
  bulkTasksValidator, 
  safeControllerFunction(TasksController.bulkDelete)
);

// With custom field name
someApiRouter.put(
  "/bulk/process", 
  verifyBulkTaskAccessMiddleware('body', 'task_ids'),  // Custom field
  safeControllerFunction(SomeController.bulkProcess)
);
```

## ⚠️ Common Mistakes to Avoid

### ❌ DON'T: Forget to add authorization

```typescript
// WRONG - No authorization check!
tasksApiRouter.delete("/:id", safeControllerFunction(TasksController.deleteById));
```

### ✅ DO: Always add authorization

```typescript
// CORRECT
tasksApiRouter.delete(
  "/:id", 
  verifyTaskAccess('params', 'id'),
  safeControllerFunction(TasksController.deleteById)
);
```

### ❌ DON'T: Add middleware after controller

```typescript
// WRONG - Middleware must come BEFORE controller
tasksApiRouter.delete(
  "/:id", 
  safeControllerFunction(TasksController.deleteById),
  verifyTaskAccess('params', 'id')  // Too late!
);
```

### ✅ DO: Add middleware before controller

```typescript
// CORRECT - Middleware executes before controller
tasksApiRouter.delete(
  "/:id", 
  verifyTaskAccess('params', 'id'),
  safeControllerFunction(TasksController.deleteById)
);
```

### ❌ DON'T: Use wrong location/field name

```typescript
// WRONG - task_id is in body, not params!
taskCommentsApiRouter.post(
  "/", 
  verifyTaskAccess('params', 'task_id'),  // Wrong location
  safeControllerFunction(TaskCommentsController.create)
);
```

### ✅ DO: Specify correct location and field name

```typescript
// CORRECT
taskCommentsApiRouter.post(
  "/", 
  verifyTaskAccess('body', 'task_id'),  // Correct location
  safeControllerFunction(TaskCommentsController.create)
);
```

## 🧪 Testing Your Implementation

### Manual Testing

1. **Create two users in different organizations**
   - User A in Organization A
   - User B in Organization B

2. **Create a task as User A**
   - Note the task ID

3. **Try to access/modify the task as User B**
   - Should receive 403 Forbidden

4. **Verify error message**
   - Should say: "You do not have permission to access this task"

### Automated Testing

```typescript
describe('Task Authorization', () => {
  it('should prevent cross-organization task access', async () => {
    const userA = await createUser('orgA');
    const userB = await createUser('orgB');
    
    const task = await createTask(userA);
    
    const response = await request(app)
      .delete(`/api/v1/tasks/${task.id}`)
      .set('Cookie', userB.sessionCookie);
    
    expect(response.status).toBe(403);
    expect(response.body.message).toContain('permission');
  });
});
```

## 🔍 Debugging Authorization Issues

### Check Middleware Order

Ensure authorization middleware comes before the controller:

```typescript
// Correct order:
router.verb(
  "/path",
  validator1,           // 1. Validate input
  validator2,           // 2. More validation
  verifyTaskAccess(...), // 3. Check authorization
  safeControllerFunction(Controller.method) // 4. Execute controller
);
```

### Enable Debug Logging

Temporarily add logging to the middleware:

```typescript
console.log('Checking task access:', {
  taskId,
  teamId,
  userId
});
```

### Check Database Relationships

Verify the task belongs to the expected project and team:

```sql
SELECT t.id, t.name, p.id as project_id, p.team_id
FROM tasks t
INNER JOIN projects p ON t.project_id = p.id
WHERE t.id = 'your-task-id';
```

## 📋 Checklist for New Endpoints

When creating a new task-related endpoint:

- [ ] Identify where the task ID comes from (params/body/query)
- [ ] Import the appropriate middleware
- [ ] Add middleware before controller in route definition
- [ ] Specify correct location ('params', 'body', or 'query')
- [ ] Specify correct field name (default: 'id')
- [ ] Test with users from different organizations
- [ ] Verify 403 response for unauthorized access
- [ ] Check that authorized users can still access

## 🆘 Need Help?

If you're unsure which middleware to use:

1. **Direct task operations?** → Use `verifyTaskAccess()`
2. **Comment operations?** → Use `verifyTaskAccessViaComment()`
3. **Work log operations?** → Use `verifyTaskAccessViaWorkLog()`
4. **Dependency operations?** → Use `verifyTaskAccessViaDependency()`
5. **Multiple tasks at once?** → Use `verifyBulkTaskAccessMiddleware()`

## 📚 Reference

For more details, see:
- [IDOR Vulnerability Fix Documentation](./IDOR_VULNERABILITY_FIX.md)
- [Middleware Source Code](../worklenz-backend/src/middlewares/verify-task-access.ts)

---

**Remember:** When in doubt, add authorization. It's better to be too secure than not secure enough! 🔒

