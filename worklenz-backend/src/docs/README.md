# Worklenz API Documentation Guide

This guide explains how to access, update, and maintain the Worklenz API documentation using OpenAPI 3.0 and Swagger UI.

## Table of Contents

- [Accessing the Documentation](#accessing-the-documentation)
- [Documentation Structure](#documentation-structure)
- [Adding New Endpoints](#adding-new-endpoints)
- [Schema Conventions](#schema-conventions)
- [Authentication Requirements](#authentication-requirements)
- [Testing with Swagger UI](#testing-with-swagger-ui)
- [Best Practices](#best-practices)
- [Validation](#validation)

## Accessing the Documentation

### Development Environment

1. Start the development server:
   ```bash
   npm run build:dev
   npm run dev
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000/api-docs
   ```

3. You should see the interactive Swagger UI interface with all documented endpoints.

**Note:** Swagger UI is **only available in development mode** for security reasons. It will not be accessible in production builds.

## Documentation Structure

The OpenAPI specification is located at:
```
worklenz-backend/src/docs/openapi.yaml
```

### File Organization

```yaml
openapi.yaml
├── info            # API metadata (title, version, description)
├── servers         # Development and production URLs
├── tags            # Endpoint categories
├── security        # Global security requirements
├── paths           # API endpoints documentation
└── components
    ├── securitySchemes  # Authentication methods
    ├── parameters       # Reusable parameters
    ├── schemas          # Data models
    └── responses        # Standard responses
```

## Adding New Endpoints

When adding a new API endpoint to the codebase, follow these steps:

### 1. Document the Endpoint FIRST

Before implementing the endpoint, add its documentation to `openapi.yaml`. This helps you design the API contract upfront.

**Example: Adding a new task endpoint**

```yaml
paths:
  /tasks/archive/{id}:
    put:
      tags:
        - Tasks
      summary: Archive a task
      description: Move a task to the archive
      parameters:
        - $ref: '#/components/parameters/idParam'
      requestBody:
        required: false
      responses:
        '200':
          description: Task archived successfully
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/ServerResponse'
                  - type: object
                    properties:
                      body:
                        $ref: '#/components/schemas/Task'
        '404':
          description: Task not found
```

### 2. Implement the Endpoint

Create the route handler in your router file (e.g., `tasks-api-router.ts`):

```typescript
tasksApiRouter.put("/archive/:id",
  idParamValidator,
  verifyTaskAccess('params', 'id'),
  safeControllerFunction(TasksController.archive)
);
```

### 3. Validate Using Swagger UI

1. Reload the development server
2. Open http://localhost:3000/api-docs
3. Find your new endpoint
4. Click "Try it out"
5. Test the endpoint with sample data

## Schema Conventions

### Always Use ServerResponse Wrapper

All endpoints return a `ServerResponse<T>` wrapper. When documenting responses, use:

```yaml
responses:
  '200':
    description: Success message
    content:
      application/json:
        schema:
          allOf:
            - $ref: '#/components/schemas/ServerResponse'
            - type: object
              properties:
                body:
                  $ref: '#/components/schemas/YourDataType'
```

### Define Reusable Schemas

For complex data types, create reusable schemas in the `components/schemas` section:

```yaml
components:
  schemas:
    TaskLabel:
      type: object
      properties:
        name:
          type: string
          maxLength: 50
        color:
          type: string
          pattern: '^#[0-9A-Fa-f]{6}$'
```

Then reference it in your endpoint:

```yaml
body:
  type: array
  items:
    $ref: '#/components/schemas/TaskLabel'
```

### Validation Constraints

Mirror your middleware validators in the schema:

| Validator Code | OpenAPI Equivalent |
|----------------|-------------------|
| `maxLength: 100` | `maxLength: 100` |
| `required: true` | `required: ['fieldName']` |
| `format: uuid` | `format: uuid` |
| `minimum: 0` | `minimum: 0` |
| `pattern: regex` | `pattern: 'regex'` |

**Example:**

```typescript
// Middleware validator
if (req.body.name.length > 100)
  return res.status(200).send(new ServerResponse(false, null, "Name too long"));
```

```yaml
# OpenAPI schema
name:
  type: string
  maxLength: 100
  description: Task name
```

## Authentication Requirements

### Global Security (Default)

By default, all endpoints require both session authentication and CSRF token:

```yaml
security:
  - sessionAuth: []
    csrfToken: []
```

### Override for GET Requests

GET requests typically only need session auth (no CSRF):

```yaml
paths:
  /tasks/info:
    get:
      security:
        - sessionAuth: []  # Override global security
      # ... rest of endpoint definition
```

### Public Endpoints

For endpoints that don't require authentication:

```yaml
paths:
  /public/health:
    get:
      security: []  # No authentication required
      # ... rest of endpoint definition
```

## Testing with Swagger UI

### Authentication Flow

1. **Login** (if not already authenticated)
   - Use your normal login flow in the app or via `/secure/login`

2. **Get CSRF Token**
   - In Swagger UI, find the "Authentication" section
   - Expand `GET /csrf-token`
   - Click "Try it out" → "Execute"
   - Copy the token from the response

3. **Authorize**
   - Click the "Authorize" button at the top of Swagger UI
   - Paste the CSRF token into the `csrfToken (X-CSRF-Token)` field
   - Click "Authorize" → "Close"

4. **Test Endpoints**
   - Now you can test any POST/PUT/DELETE endpoint
   - The CSRF token will be automatically included in headers

### Using "Try It Out"

1. Expand any endpoint
2. Click "Try it out"
3. Fill in the request parameters/body
4. Click "Execute"
5. View the response below

**Tip:** Enable "Persist Authorization" in the top-right to save your auth tokens between page refreshes.

## Best Practices

### 1. Clear Descriptions

Write concise, actionable descriptions:

```yaml
# ✅ Good
summary: "Create a new task"
description: "Creates a new task with the specified properties and assigns it to the project"

# ❌ Bad
summary: "Task creation"
description: "Creates task"
```

### 2. Realistic Examples

Provide realistic example values:

```yaml
properties:
  name:
    type: string
    example: "Implement user authentication"  # ✅ Realistic
    # NOT: "string" or "task name"  # ❌ Generic
```

### 3. Consistent Naming

- **Endpoints**: Use kebab-case (`/task-comments`, not `/taskComments`)
- **Properties**: Use snake_case (`project_id`, not `projectId`) to match database
- **Schemas**: Use PascalCase (`TaskCreateRequest`, not `task_create_request`)

### 4. Document Edge Cases

```yaml
responses:
  '200':
    description: Task updated successfully
  '400':
    description: Validation failed (name too long, invalid dates, etc.)
  '403':
    description: Insufficient permissions
  '404':
    description: Task not found
```

### 5. Use References

Avoid duplication by using `$ref`:

```yaml
# ✅ Good
parameters:
  - $ref: '#/components/parameters/idParam'

# ❌ Bad - duplicating the same definition everywhere
parameters:
  - name: id
    in: path
    required: true
    schema:
      type: string
      format: uuid
```

## Validation

### Manual Validation

After making changes to `openapi.yaml`, check for syntax errors:

```bash
npm run validate-docs
```

This runs `swagger-cli validate` to check for:
- YAML syntax errors
- OpenAPI specification compliance
- Broken `$ref` references
- Missing required fields

### Automatic Validation

The Swagger UI will also display errors if:
- The YAML has syntax errors
- Schemas are malformed
- References are broken

Check the browser console for detailed error messages.

## Updating Documentation

### When to Update

Update `openapi.yaml` whenever you:

1. **Add a new endpoint** → Document it before implementation
2. **Modify request/response structure** → Update schemas
3. **Change validation rules** → Update schema constraints
4. **Add/remove query parameters** → Update parameter definitions
5. **Change authentication requirements** → Update security schemes

### Workflow

```bash
# 1. Edit the OpenAPI spec
vim src/docs/openapi.yaml

# 2. Validate the changes
npm run validate-docs

# 3. Restart the dev server (if running)
# Swagger UI will auto-reload with new changes

# 4. Test in Swagger UI
# Open http://localhost:3000/api-docs
# Verify the endpoint appears correctly
# Test with "Try it out"

# 5. Commit the changes
git add src/docs/openapi.yaml
git commit -m "docs: add endpoint for task archiving"
```

## Progressive Documentation Strategy

Given the large number of endpoints (~70+ routers), document in phases:

### Phase 1: Core Endpoints (Complete ✅)
- Authentication (`/csrf-token`)
- Tasks CRUD (`/tasks`, `/tasks/{id}`, `/tasks/info`)
- Projects CRUD (`/projects`, `/projects/{id}`)
- Teams (`/teams`, `/teams/invites`)
- Task Comments & Subtasks

### Phase 2: Extended Features
- Time logs
- Task subscribers
- Project members
- Reporting endpoints
- Task dependencies

### Phase 3: Configuration
- Statuses (`/statuses`)
- Priorities (`/priorities`)
- Labels (`/labels`)
- Project templates
- Custom fields

### Phase 4: Advanced Features
- Gantt chart APIs
- Roadmap views
- Client portal endpoints
- Billing/invoicing
- Integration webhooks
- Admin endpoints

## Troubleshooting

### Swagger UI Not Loading

1. Check the console output for errors:
   ```
   Failed to load OpenAPI documentation: Error: ...
   ```

2. Verify the YAML file exists:
   ```bash
   ls -la src/docs/openapi.yaml
   ```

3. Validate YAML syntax:
   ```bash
   npm run validate-docs
   ```

4. Ensure you're in development mode (not production)

### "Failed to fetch" in Swagger UI

- Check that the development server is running
- Verify you're logged in (session exists)
- Check browser console for CORS errors
- Ensure the endpoint URL is correct

### Authentication Issues

- Make sure to call `GET /csrf-token` first
- Copy the token from the response `body.token` field
- Click "Authorize" and paste the token
- Try the request again

## Future Enhancements

### Split YAML Files

If `openapi.yaml` exceeds 3000 lines, consider splitting:

```yaml
# openapi.yaml
paths:
  $ref: './paths/index.yaml'

components:
  schemas:
    $ref: './schemas/index.yaml'
```

### Generate Client SDKs

Use `openapi-generator` to create TypeScript/Python clients:

```bash
npm install -g @openapitools/openapi-generator-cli

openapi-generator-cli generate \
  -i src/docs/openapi.yaml \
  -g typescript-axios \
  -o ../worklenz-frontend/src/api-client
```

### Contract Testing

Generate automated tests from the spec:

```bash
npm install -g dredd
dredd src/docs/openapi.yaml http://localhost:5000
```

### CI/CD Integration

Add validation to your CI pipeline:

```yaml
# .github/workflows/api-docs.yml
- name: Validate OpenAPI Spec
  run: npm run validate-docs
```

## Questions?

For questions or issues with API documentation:
1. Check this README
2. Review existing endpoint examples in `openapi.yaml`
3. Consult the [OpenAPI 3.0 Specification](https://swagger.io/specification/)
4. Ask in the team Slack channel
