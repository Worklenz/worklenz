# General Coding Guidelines

## Rule Summary
Follow these rules when you write code:

1. **Use Early Returns**
   - Prefer early returns and guard clauses to reduce nesting and improve readability, especially for error handling.

2. **Tailwind for Styling**
   - Always use Tailwind CSS utility classes for styling HTML elements.
   - Avoid writing custom CSS or using inline `style` tags.

3. **Class Tag Syntax**
   - Use `class:` directive (e.g., `class:active={isActive}`) instead of the ternary operator in class tags whenever possible.

4. **Descriptive Naming**
   - Use clear, descriptive names for variables, functions, and constants.
   - Use auxiliary verbs for booleans and state (e.g., `isLoaded`, `hasError`, `shouldRender`).
   - Event handler functions should be prefixed with `handle`, e.g., `handleClick` for `onClick`, `handleKeyDown` for `onKeyDown`.

5. **Naming Conventions**
   - **Directories:** Use lowercase with dashes (e.g., `components/auth-wizard`).
   - **Variables & Functions:** Use `camelCase` (e.g., `userList`, `fetchData`).
   - **Types & Interfaces:** Use `PascalCase` (e.g., `User`, `ButtonProps`).
   - **Exports:** Favor named exports for components.
   - **No Unused Variables:** Remove unused variables and imports.

6. **File Layout**
   - Order: exported component → subcomponents → hooks/helpers → static content.

7. **Props & Types**
   - Define props with TypeScript `interface` or `type`, not `prop-types`.
   - Example:
     ```ts
     interface ButtonProps {
       label: string;
       onClick?: () => void;
     }

     export function Button({ label, onClick }: ButtonProps) {
       return <button onClick={onClick}>{label}</button>;
     }
     ```

8. **Component Declaration**
   - Use the `function` keyword for components, not arrow functions.

9. **Hooks Usage**
   - Call hooks (e.g., `useState`, `useEffect`) only at the top level of components.
   - Extract reusable logic into custom hooks (e.g., `useAuth`, `useFormValidation`).

10. **Memoization & Performance**
    - Use `React.memo`, `useCallback`, and `useMemo` where appropriate.
    - Avoid inline functions in JSX—pull handlers out or wrap in `useCallback`.

11. **Composition**
    - Favor composition (render props, `children`) over inheritance.

12. **Code Splitting**
    - Use `React.lazy` + `Suspense` for code splitting.

13. **Refs**
    - Use refs only for direct DOM access.

14. **Forms**
    - Prefer controlled components for forms.

15. **Error Boundaries**
    - Implement an error boundary component for catching render errors.

16. **Effect Cleanup**
    - Clean up effects in `useEffect` to prevent memory leaks.

17. **Accessibility**
    - Apply appropriate ARIA attributes to interactive elements.
    - For example, an `<a>` tag should have `tabindex="0"`, `aria-label`, `onClick`, and `onKeyDown` attributes as appropriate.

## Examples

### ✅ Correct
```tsx
// File: components/user-profile.tsx

interface UserProfileProps {
  user: User;
  isLoaded: boolean;
  hasError: boolean;
}

export function UserProfile({ user, isLoaded, hasError }: UserProfileProps) {
  if (!isLoaded) return <div>Loading...</div>;
  if (hasError) return <div role="alert">Error loading user.</div>;

  const handleClick = useCallback(() => {
    // ...
  }, [user]);

  return (
    <button
      className="bg-blue-500 text-white"
      aria-label="View user profile"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {user.name}
    </button>
  );
}
```

### ❌ Incorrect
```tsx
// File: components/UserProfile.jsx
function userprofile(props) {
  if (props.isLoaded) {
    // ...
  }
}

return (
  <button style={{ color: 'white' }} onClick={() => doSomething()}>
    View
  </button>
);
```

## Enforcement
- All new code must follow these guidelines.
- Code reviews should reject code that does not comply with these rules.
- Refactor existing code to follow these guidelines when making changes. 