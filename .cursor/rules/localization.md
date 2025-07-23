# Localization Rule: No Hard-Coded User-Facing Text

## Rule
- All user-facing text **must** be added to the localization system at `@/locales`.
- **Never** hard-code user-facing strings directly in components, pages, or business logic.
- Use the appropriate i18n or localization utility to fetch and display all text.
- **Always** provide a `defaultValue` when using the `t()` function for translations, e.g., `{t('emailPlaceholder', {defaultValue: 'Enter your email'})}`.

## Rationale
- Ensures the application is fully translatable and accessible to all supported languages.
- Prevents missed strings during translation updates.
- Promotes consistency and maintainability.
- Providing a `defaultValue` ensures a fallback is shown if the translation key is missing.

## Examples

### ✅ Correct
```tsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();

return <input placeholder={t('emailPlaceholder', { defaultValue: 'Enter your email' })} />;
```

### ❌ Incorrect
```tsx
return <input placeholder={t('emailPlaceholder')} />;

// or
return <input placeholder="Enter your email" />;
```

## Enforcement
- All new user-facing text **must** be added to the appropriate file in `@/locales`.
- Every use of `t()` **must** include a `defaultValue` for fallback.
- Code reviews should reject any hard-coded user-facing strings or missing `defaultValue` in translations.
- Refactor existing hard-coded text to use the localization system and add `defaultValue` when modifying related code. 