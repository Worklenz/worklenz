# React Component Naming Rule: PascalCase

## Rule
- All React component names **must** use PascalCase.
- This applies to:
  - Component file names (e.g., `MyComponent.tsx`, `UserProfile.jsx`)
  - Exported component identifiers (e.g., `export const MyComponent = ...` or `function UserProfile() { ... }`)

## Rationale
- PascalCase is the community standard for React components.
- Ensures consistency and readability across the codebase.
- Prevents confusion between components and regular functions/variables.

## Examples

### ✅ Correct
```tsx
// File: UserProfile.tsx
export function UserProfile() { ... }

// File: TaskList.tsx
const TaskList = () => { ... }
export default TaskList;
```

### ❌ Incorrect
```tsx
// File: userprofile.tsx
export function userprofile() { ... }

// File: task-list.jsx
const task_list = () => { ... }
export default task_list;
```

## Enforcement
- All new React components **must** follow this rule.
- Refactor existing components to PascalCase when modifying or moving them.
- Code reviews should reject non-PascalCase component names. 