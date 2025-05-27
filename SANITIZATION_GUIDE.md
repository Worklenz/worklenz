# Worklenz Input Sanitization Guide

This document outlines the comprehensive input sanitization implementation for the Worklenz application, covering both frontend and backend security measures.

## Overview

Input sanitization is crucial for preventing XSS (Cross-Site Scripting) attacks, SQL injection, and other security vulnerabilities. This implementation provides multiple layers of protection:

1. **Frontend Sanitization**: Client-side input cleaning using DOMPurify
2. **Backend Sanitization**: Server-side input validation and cleaning using sanitize-html
3. **Middleware Protection**: Automatic sanitization of all incoming requests
4. **Form-Specific Sanitization**: Context-aware cleaning based on input type

## Frontend Implementation

### Core Sanitization Utilities (`worklenz-frontend/src/utils/sanitizeInput.ts`)

#### Available Functions:

- **`sanitizeInput(input, options?)`**: General purpose sanitization, strips all HTML
- **`sanitizeHtml(input)`**: Allows basic HTML tags for rich content
- **`sanitizeFormInput(input)`**: Form-specific sanitization preserving legitimate content
- **`sanitizeEmail(email)`**: Email-specific sanitization
- **`sanitizeName(name)`**: Name/title sanitization allowing letters, numbers, spaces, hyphens, apostrophes
- **`sanitizeUrl(url)`**: URL sanitization removing dangerous protocols
- **`sanitizeRichText(content)`**: Rich text editor content sanitization

#### Example Usage:

```typescript
import { sanitizeName, sanitizeEmail, sanitizeFormInput } from '@/utils/sanitizeInput';

// Sanitize user input
const cleanName = sanitizeName(userInput.name);
const cleanEmail = sanitizeEmail(userInput.email);
const cleanPassword = sanitizeFormInput(userInput.password);
```

### Sanitized Form Hook (`worklenz-frontend/src/hooks/useSanitizedForm.ts`)

A React hook that provides automatic form sanitization:

```typescript
import { useSanitizedForm, FORM_SANITIZATION_CONFIGS } from '@/hooks/useSanitizedForm';

const MyComponent = () => {
  const { form, handleSubmit } = useSanitizedForm({
    sanitizationConfig: FORM_SANITIZATION_CONFIGS.userForm,
  });

  const onFinish = async (values) => {
    // Values are automatically sanitized
    await submitForm(values);
  };

  return (
    <Form form={form} onFinish={onFinish}>
      {/* Form fields */}
    </Form>
  );
};
```

#### Predefined Configurations:

- **`userForm`**: For user registration/profile forms
- **`projectForm`**: For project/team creation forms
- **`taskForm`**: For task creation/editing forms
- **`commentForm`**: For comment/message forms
- **`settingsForm`**: For settings/configuration forms

## Backend Implementation

### Core Sanitization Utilities (`worklenz-backend/src/shared/utils.ts`)

#### Available Functions:

- **`sanitizeUserInput(value)`**: General input sanitization
- **`sanitizeEmail(email)`**: Email-specific sanitization
- **`sanitizeName(name)`**: Name/title sanitization
- **`sanitizePassword(password)`**: Password sanitization (minimal to preserve integrity)
- **`sanitizeUrl(url)`**: URL sanitization
- **`sanitizeRichText(content)`**: Rich text content sanitization
- **`sanitizeObject(obj)`**: Recursive object sanitization

#### Example Usage:

```typescript
import { sanitizeName, sanitizeEmail, sanitizePassword } from '../shared/utils';

// In a validator or controller
const cleanName = sanitizeName(req.body.name);
const cleanEmail = sanitizeEmail(req.body.email);
const cleanPassword = sanitizePassword(req.body.password);
```

### Sanitization Middleware (`worklenz-backend/src/middlewares/sanitization-middleware.ts`)

#### Available Middleware:

1. **`sanitizeRequestData`**: Applied globally to sanitize all incoming requests
2. **`sanitizeFormData`**: Context-aware sanitization for form submissions
3. **`sanitizeRichTextData`**: Specialized for rich text content

#### Usage in Routes:

```typescript
import { sanitizeFormData } from '../middlewares/sanitization-middleware';

// Apply to specific routes
router.post('/signup', sanitizeFormData, signUpValidator, controller);

// Or apply globally in app.ts
app.use(sanitizeRequestData);
```

### Enhanced Validators

Validators now include sanitization before validation:

```typescript
// Example: sign-up-validator.ts
export default function (req: Request, res: Response, next: NextFunction) {
  const { name, email, password } = req.body;
  
  // Sanitize inputs
  const sanitizedName = sanitizeName(name);
  const sanitizedEmail = sanitizeEmail(email);
  const sanitizedPassword = sanitizePassword(password);
  
  // Validate sanitized inputs
  if (!sanitizedName.trim()) return res.status(200).send(new ServerResponse(false, null, "Invalid name format"));
  
  // Update request body with sanitized values
  req.body.name = sanitizedName;
  req.body.email = sanitizedEmail;
  req.body.password = sanitizedPassword;
  
  return next();
}
```

## Security Features

### XSS Prevention

- **HTML Tag Removal**: All dangerous HTML tags are stripped
- **Script Injection Prevention**: JavaScript protocols and event handlers are removed
- **Attribute Sanitization**: Only safe attributes are allowed in rich text

### Input Validation

- **Type-Specific Sanitization**: Different sanitization rules for emails, names, URLs, etc.
- **Character Filtering**: Only allowed characters are preserved
- **Length Validation**: Combined with existing validation rules

### Content Security

- **Rich Text Safety**: Allows only safe HTML tags and attributes
- **URL Protocol Filtering**: Removes dangerous protocols (javascript:, data:, etc.)
- **Recursive Object Sanitization**: Handles nested objects and arrays

## Implementation Examples

### Frontend Form with Sanitization

```typescript
// signup-page.tsx
import { useSanitizedForm, FORM_SANITIZATION_CONFIGS } from '@/hooks/useSanitizedForm';

const SignupPage = () => {
  const { form, handleSubmit } = useSanitizedForm({
    sanitizationConfig: FORM_SANITIZATION_CONFIGS.userForm,
  });

  const onFinish = async (values: IUserSignUpRequest) => {
    // Additional manual sanitization if needed
    const body = {
      name: sanitizeName(values.name),
      email: sanitizeEmail(values.email),
      password: sanitizeFormInput(values.password),
    };

    // Submit sanitized data
    await authApiService.signUpCheck(body);
  };

  return (
    <Form form={form} onFinish={onFinish}>
      <Form.Item name="name" rules={nameRules}>
        <Input placeholder="Enter your name" />
      </Form.Item>
      {/* Other form fields */}
    </Form>
  );
};
```

### Backend Route with Sanitization

```typescript
// auth/index.ts
import { sanitizeFormData } from '../../middlewares/sanitization-middleware';

authRouter.post("/signup", 
  sanitizeFormData,           // Apply form sanitization
  signUpValidator,            // Validate sanitized data
  passwordValidator,          // Additional validation
  passport.authenticate("local-signup", options("signup"))
);
```

## Best Practices

### Frontend

1. **Always sanitize user input** before sending to backend
2. **Use appropriate sanitization type** for each field (email, name, URL, etc.)
3. **Validate sanitized data** to ensure it's not empty after cleaning
4. **Use the sanitized form hook** for consistent behavior across forms

### Backend

1. **Apply global sanitization middleware** early in the middleware chain
2. **Use context-specific sanitization** in validators
3. **Validate after sanitization** to ensure data integrity
4. **Log sanitization errors** for monitoring

### General

1. **Defense in depth**: Apply sanitization at multiple layers
2. **Regular updates**: Keep sanitization libraries updated
3. **Testing**: Test with malicious inputs to verify protection
4. **Documentation**: Keep this guide updated with changes

## Configuration

### Frontend Dependencies

- **DOMPurify**: ^3.2.5 - Client-side HTML sanitization

### Backend Dependencies

- **sanitize-html**: ^2.11.0 - Server-side HTML sanitization
- **xss-filters**: ^1.2.7 - Additional XSS protection

## Monitoring and Maintenance

### Regular Tasks

1. **Update dependencies** regularly for security patches
2. **Review sanitization logs** for potential attacks
3. **Test new input types** with appropriate sanitization
4. **Monitor performance impact** of sanitization middleware

### Security Auditing

1. **Penetration testing** with XSS payloads
2. **Code review** of new form implementations
3. **Dependency vulnerability scanning**
4. **Regular security assessments**

## Troubleshooting

### Common Issues

1. **Over-sanitization**: Legitimate content being removed
   - Solution: Use appropriate sanitization type for the field
   
2. **Performance impact**: Sanitization slowing down requests
   - Solution: Optimize sanitization rules, consider caching
   
3. **Validation failures**: Sanitized data failing validation
   - Solution: Update validation rules to work with sanitized data

### Debugging

1. **Enable sanitization logging** in development
2. **Compare before/after sanitization** values
3. **Test with various input types** and edge cases

## Future Enhancements

1. **Content Security Policy (CSP)** headers for additional protection
2. **Rate limiting** for form submissions
3. **Input validation schemas** using JSON Schema
4. **Automated security testing** in CI/CD pipeline
5. **Real-time threat detection** and blocking 