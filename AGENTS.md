# Worklenz Cursor Rules for AI Assistants

## 🎯 Project Overview
Worklenz is a full-stack project management application with React frontend, Node.js/Express backend, and PostgreSQL database. This document provides cursor rules for AI assistants working on this codebase.

## 📋 General Development Rules

### 🎨 UI/UX Guidelines
- **Always consider dark/light theme compatibility** when creating or modifying UI components
- **No hardcoded text** - all user-facing strings must use i18next localization
- **Follow Ant Design patterns** - use existing components and design tokens consistently
- **Responsive design** - ensure components work on mobile, tablet, and desktop
- **Accessibility first** - include proper ARIA labels, keyboard navigation, and screen reader support

### 🔧 Code Quality Standards
- **TypeScript strict mode** - use strict typing, avoid `any` types
- **Functional programming** - prefer functional patterns over classes
- **Descriptive naming** - use auxiliary verbs (e.g., `isLoading`, `hasError`, `canEdit`)
- **Modular structure** - break down complex components into smaller, reusable pieces
- **Performance conscious** - use React.memo, useMemo, useCallback appropriately

### 📁 File Organization
```
# Component file structure pattern
export const MainComponent = () => { /* main component */ };

const SubComponent = () => { /* subcomponent */ };
const AnotherSubComponent = () => { /* another subcomponent */ };

// Helper functions
const formatData = (data: DataType) => { /* helper logic */ };
const validateInput = (input: string) => { /* validation logic */ };

// Static content
const DEFAULT_CONFIG = { /* static configuration */ };
const ERROR_MESSAGES = { /* error messages */ };

// Types and interfaces
interface ComponentProps {
  data: DataType;
  onSubmit: (value: string) => void;
}
```

## 🚀 Frontend-Specific Rules

### React/TypeScript Patterns
- **Prefer interfaces over types** for object shapes
- **Use custom hooks** for reusable logic (auth, API calls, socket connections)
- **Implement error boundaries** for graceful error handling
- **Follow Redux Toolkit patterns** for state management
- **Use React 18 features** (Suspense, concurrent rendering)

### Component Development
```typescript
// ✅ Preferred: Named export with proper typing
interface TaskCardProps {
  task: IProjectTask;
  onUpdate: (taskId: string, updates: Partial<IProjectTask>) => void;
  isSelected?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onUpdate,
  isSelected = false
}) => {
  // Component logic
};

// ❌ Avoid: Default export, unnecessary React.FC
const TaskCard = (props: any) => {
  // Component logic
};
export default TaskCard;
```

### State Management
- **Use Redux Toolkit** for global state management
- **Feature-based organization** - group related actions, reducers, selectors
- **Typed selectors** with proper error handling
- **Optimistic updates** for better UX, with rollback on failure

### API Integration
- **RTK Query for server state** - use existing API services pattern
- **Proper error handling** - use try/catch with user-friendly error messages
- **Loading states** - always show loading indicators for async operations
- **Cache management** - invalidate cache appropriately on mutations

## 🏗️ Backend-Specific Rules

### Express.js Patterns
- **MVC structure** - controllers handle business logic, routes define endpoints
- **Middleware chain** - authentication, validation, error handling
- **Consistent response format** - use established response patterns
- **Input validation** - validate all inputs, never trust client data

### Database Operations
- **Use transactions** for multi-table operations
- **Prepared statements** - prevent SQL injection
- **Proper indexing** - consider query performance
- **Migration safety** - ensure migrations are reversible

### Socket.IO Implementation
- **Namespace organization** - use appropriate namespaces for different features
- **Event naming** - consistent, descriptive event names
- **Error handling** - handle socket errors gracefully
- **Connection management** - handle disconnects and reconnections

## 🔄 Real-time Features

### WebSocket Events
- **Consistent event naming** - use established patterns
- **Proper typing** - type all event payloads
- **Error handling** - handle connection failures
- **Performance** - avoid sending unnecessary updates

### Collaboration Features
- **Optimistic updates** - update UI immediately, rollback on failure
- **Conflict resolution** - handle concurrent modifications
- **User feedback** - show who made changes and when

## 🎨 Styling Guidelines

### Tailwind CSS Usage
- **Utility-first approach** - use Tailwind classes primarily
- **Consistent spacing** - use established spacing scale
- **Dark mode support** - test all components in both themes
- **Responsive design** - use responsive utilities appropriately

### Ant Design Integration
- **Follow design tokens** - use theme variables, not hardcoded colors
- **Consistent component usage** - use established component patterns
- **Custom styling** - extend rather than override Ant Design styles
- **Theme awareness** - respect user's theme preference

## 📝 Localization Rules

### i18next Integration
- **No hardcoded strings** - all user text must be localized
- **Namespace organization** - group related strings by feature
- **Pluralization support** - use i18next pluralization features
- **Interpolation** - use variables safely with proper escaping

### Translation Structure
```
public/locales/en/
├── common.json          # Shared strings
├── auth.json           # Authentication
├── tasks.json          # Task management
├── projects.json       # Project management
└── settings.json       # User settings
```

## 🧪 Testing Guidelines

### Component Testing
- **React Testing Library** for component testing
- **User-centric testing** - test user interactions, not implementation details
- **Accessibility testing** - include a11y checks
- **Visual regression** - test component appearance

### API Testing
- **Integration tests** for API endpoints
- **Database isolation** - use test database or transactions
- **Authentication testing** - test protected routes
- **Error scenarios** - test error conditions and edge cases

## 🚀 Performance Optimization

### Frontend Performance
- **Code splitting** - use dynamic imports for large components
- **Virtualization** - for large lists (react-window)
- **Image optimization** - use appropriate formats and sizes
- **Bundle analysis** - monitor bundle size and dependencies

### Backend Performance
- **Database optimization** - use proper indexes and query optimization
- **Caching strategy** - implement appropriate caching layers
- **Rate limiting** - protect against abuse
- **Monitoring** - implement performance monitoring

## 🔒 Security Guidelines

### Frontend Security
- **XSS prevention** - sanitize user input, use React's built-in protection
- **CSRF protection** - use established CSRF tokens
- **Secure storage** - never store sensitive data in localStorage
- **Input validation** - validate all user inputs

### Backend Security
- **Authentication** - use established auth patterns
- **Authorization** - check permissions on all protected routes
- **Data validation** - validate and sanitize all inputs
- **SQL injection prevention** - use prepared statements

## � Authentication & Security Configuration

### CSRF Protection

Worklenz uses CSRF (Cross-Site Request Forgery) protection for the main application API routes.

#### Backend Configuration

**Location**: `worklenz-backend/src/app.ts`

```typescript
// CSRF protection is applied to /api/v1 routes
app.use("/api/v1", apiLimiter, isLoggedIn, apiRouter);

// Client portal routes are EXCLUDED from CSRF protection
app.use("/api/client-portal", apiLimiter, clientPortalApiRouter);
```

**CSRF Exclusion Middleware**:
```typescript
app.use((req, res, next) => {
  // Exclude client portal endpoints (they use client token authentication)
  if (req.path.startsWith("/client-portal") || req.originalUrl.startsWith("/api/client-portal")) {
    return next();
  }
  
  // Apply CSRF protection to state-changing operations
  const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
  if (isStateChanging) {
    csrfSynchronisedProtection(req, res, next);
  } else {
    next();
  }
});
```

#### Frontend Configuration (Main App)

**Location**: `worklenz-frontend/src/api/api-client.ts`

```typescript
// CSRF token management
export const getCsrfToken = (): string | null => {
  return localStorage.getItem('csrfToken');
};

export const refreshCsrfToken = async (): Promise<string> => {
  // Fetch new CSRF token from backend
  const response = await fetch('/api/v1/csrf-token');
  const { token } = await response.json();
  localStorage.setItem('csrfToken', token);
  return token;
};

// RTK Query configuration with CSRF
prepareHeaders: async headers => {
  let token = getCsrfToken();
  if (!token) {
    token = await refreshCsrfToken();
  }
  if (token) {
    headers.set('X-CSRF-Token', token);
  }
  return headers;
}
```

**Key Points**:
- CSRF tokens are stored in `localStorage`
- Tokens are automatically refreshed when missing
- All state-changing requests include `X-CSRF-Token` header
- CSRF protection applies to `/api/v1/*` routes only

### Client Portal Authentication

The Client Portal uses a **separate authentication mechanism** with client-specific tokens.

#### Two Frontend Applications

1. **Main Admin App** (`worklenz-frontend`)
   - For organization/admin users
   - Uses session-based auth + CSRF tokens
   - Manages client portal data from admin perspective
   - Base URL: `/api/v1` or `/api` (depending on API)

2. **Client Portal App** (`worklenz-client-portal`)
   - For client users
   - Uses `x-client-token` authentication
   - Direct client access to their data
   - Base URL: `/api/client-portal`

#### Client Portal Backend Routes

**Location**: `worklenz-backend/src/routes/apis/client-portal-api-router.ts`

```typescript
const router = express.Router();

// Public routes (no authentication)
router.post("/auth/login", safeControllerFunction(ClientPortalAuthController.clientLogin));
router.get("/invitation/validate", safeControllerFunction(ClientPortalAuthController.validateInvitation));

// Protected routes (require client authentication)
router.use(authenticateClient);

router.get("/dashboard", safeControllerFunction(ClientPortalDashboardController.getDashboard));
router.get("/invoices", safeControllerFunction(ClientPortalInvoicesController.getInvoices));
router.post("/invoices", safeControllerFunction(ClientPortalInvoicesController.createInvoice));
router.delete("/invoices/:id", safeControllerFunction(ClientPortalInvoicesController.deleteInvoice));
// ... more routes
```

#### Client Authentication Middleware

**Location**: `worklenz-backend/src/middlewares/client-auth-middleware.ts`

```typescript
export const authenticateClient = async (
  req: AuthenticatedClientRequest,
  res: Response,
  next: NextFunction
) => {
  // Get client token from headers or query params
  const clientToken = req.headers["x-client-token"] || req.query.clientToken;

  if (!clientToken) {
    return res.status(401).json(
      new ServerResponse(false, null, "Client token is required")
    );
  }

  // Verify client token
  const tokenPayload = TokenService.verifyClientToken(clientToken as string);
  
  if (!tokenPayload) {
    return res.status(401).json(
      new ServerResponse(false, null, "Invalid or expired client token")
    );
  }

  // Attach client info to request
  req.clientId = tokenPayload.clientId;
  req.organizationId = tokenPayload.organizationId;
  next();
};
```

#### Client Portal Frontend Configuration

**For Client Portal App** (`worklenz-client-portal/src/store/api.ts`):

```typescript
export const api = createApi({
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/client-portal',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('clientToken');
      if (token) {
        headers.set('x-client-token', token);
      }
      return headers;
    },
  }),
});
```

**For Admin App** (`worklenz-frontend/src/api/client-portal/client-portal-api.ts`):

```typescript
export const clientPortalApi = createApi({
  reducerPath: 'clientPortalApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${config.apiUrl}${API_BASE_URL}`,  // /api/v1
    prepareHeaders: async headers => {
      // Admin app uses CSRF tokens
      let token = getCsrfToken();
      if (!token) {
        token = await refreshCsrfToken();
      }
      if (token) {
        headers.set('X-CSRF-Token', token);
      }
      return headers;
    },
    credentials: 'include',
  }),
  endpoints: builder => ({
    // Endpoints use /clients/portal/* paths for admin management
    getInvoices: builder.query({
      query: () => '/clients/portal/invoices',  // Becomes /api/v1/clients/portal/invoices
    }),
  }),
});
```

### API Path Configuration Summary

| Frontend App | Base URL | Auth Method | Backend Route | Example Full URL |
|--------------|----------|-------------|---------------|------------------|
| Main Admin | `/api/v1` | CSRF Token + Session | `/api/v1/*` | `/api/v1/projects` |
| Admin (Client Portal Mgmt) | `/api/v1` | CSRF Token + Session | `/api/v1/clients/portal/*` | `/api/v1/clients/portal/invoices` |
| Client Portal App | `/api/client-portal` | x-client-token | `/api/client-portal/*` | `/api/client-portal/dashboard` |

### Common Authentication Issues

#### Issue: 401 Unauthorized on Client Portal Routes

**Cause**: Missing or invalid `x-client-token` header

**Solution**:
```typescript
// Ensure token is stored after login
localStorage.setItem('clientToken', token);

// Ensure token is sent in requests
headers.set('x-client-token', localStorage.getItem('clientToken'));
```

#### Issue: 404 Not Found on API Calls

**Cause**: Incorrect base URL or endpoint path configuration

**Solution**:
- **Admin managing client portal**: Use base URL `/api/v1` with endpoint paths `/clients/portal/*`
  - Example: `/api/v1/clients/portal/invoices`
- **Client portal app**: Use base URL `/api/client-portal` with endpoint paths starting with `/`
  - Example: `/api/client-portal/dashboard`
- **Main admin app**: Use base URL `/api/v1` with standard paths
  - Example: `/api/v1/projects`

#### Issue: CSRF Token Mismatch

**Cause**: Client portal routes receiving CSRF protection

**Solution**: Ensure client portal routes are excluded in `app.ts`:
```typescript
if (req.path.startsWith("/client-portal") || req.originalUrl.startsWith("/api/client-portal")) {
  return next(); // Skip CSRF protection
}
```

### Security Best Practices

1. **Never mix authentication methods**
   - Main app routes: Use CSRF tokens
   - Client portal routes: Use x-client-token
   - Don't apply CSRF to client portal routes

2. **Token storage**
   - CSRF tokens: `localStorage.getItem('csrfToken')`
   - Client tokens: `localStorage.getItem('clientToken')`
   - Never expose tokens in URLs or logs

3. **Route organization**
   - Client-facing portal routes: `/api/client-portal/*` (uses x-client-token)
   - Admin portal management routes: `/api/v1/clients/portal/*` (uses session + CSRF)
   - Main app routes: `/api/v1/*` (uses session + CSRF)
   - Use clear separation in route files

4. **Error handling**
   - Return 401 for authentication failures
   - Return 403 for authorization failures
   - Provide clear error messages for debugging

## �📚 Documentation Standards

### Code Documentation
- **JSDoc comments** for complex functions and components
- **Interface documentation** - document props and return types
- **Usage examples** - provide examples for complex APIs
- **README updates** - update documentation for significant changes

### API Documentation
- **OpenAPI/Swagger** for API endpoints
- **Request/response examples** - provide clear examples
- **Error responses** - document error conditions
- **Authentication** - document auth requirements

## 🔧 Development Workflow

### Git Practices
- **Feature branches** - create branches for new features
- **Descriptive commits** - write clear, concise commit messages
- **Code review** - follow established review process
- **Testing** - ensure tests pass before merging

### Code Review Checklist
- [ ] TypeScript types are correct and complete
- [ ] Component follows established patterns
- [ ] No hardcoded strings (i18n used)
- [ ] Dark/light theme compatibility
- [ ] Responsive design implemented
- [ ] Tests included for new functionality
- [ ] Performance considerations addressed
- [ ] Security implications reviewed

## 🎯 Task-Specific Rules

### New Feature Development
1. **Understand requirements** - clarify acceptance criteria
2. **Explore existing code** - find similar patterns to follow
3. **Plan implementation** - consider all affected components
4. **Implement incrementally** - build and test small pieces
5. **Add tests** - ensure new functionality is tested
6. **Update documentation** - document any API changes

### Bug Fixes
1. **Reproduce the issue** - understand the problem
2. **Identify root cause** - trace through the code
3. **Fix the issue** - implement the minimal fix
4. **Add regression test** - prevent future occurrences
5. **Verify fix** - test in multiple scenarios

### Refactoring
1. **Understand impact** - identify all affected code
2. **Plan incrementally** - avoid large breaking changes
3. **Maintain tests** - ensure tests still pass
4. **Update types** - keep TypeScript definitions current
5. **Document changes** - explain the refactoring rationale

---

## 🚨 Critical Rules

### Never Do These Things:
- ❌ **Hardcode user-facing text** - always use i18next
- ❌ **Use `any` type** - maintain strict TypeScript typing
- ❌ **Ignore theme compatibility** - all UI must support dark/light modes
- ❌ **Skip error handling** - always handle errors gracefully
- ❌ **Break existing API contracts** - maintain backward compatibility
- ❌ **Ignore accessibility** - all features must be accessible
- ❌ **Skip testing** - all features must be tested

### Always Do These Things:
- ✅ **Follow established patterns** - maintain consistency
- ✅ **Add proper TypeScript types** - ensure type safety
- ✅ **Test in both themes** - verify dark/light mode compatibility
- ✅ **Include error handling** - handle failures gracefully
- ✅ **Add loading states** - provide user feedback
- ✅ **Document complex logic** - help future developers
- ✅ **Consider performance impact** - optimize where possible

---

## 🎉 Best Practices Summary

1. **Quality First** - Write clean, well-typed, tested code
2. **User Experience** - Consider accessibility, performance, and usability
3. **Consistency** - Follow established patterns and conventions
4. **Collaboration** - Write code that's easy for others to understand
5. **Maintenance** - Consider long-term maintainability and scalability

Remember: Good code is not just functional, but also maintainable, accessible, and delightful to work with! 🚀
