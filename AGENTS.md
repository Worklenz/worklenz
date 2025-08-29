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

## 📚 Documentation Standards

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
