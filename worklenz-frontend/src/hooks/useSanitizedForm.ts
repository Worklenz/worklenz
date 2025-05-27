import { useCallback, useMemo } from 'react';
import { Form } from 'antd';
import { 
  sanitizeInput, 
  sanitizeName, 
  sanitizeEmail, 
  sanitizeFormInput, 
  sanitizeUrl,
  sanitizeRichText 
} from '@/utils/sanitizeInput';

export type SanitizationType = 'input' | 'name' | 'email' | 'form' | 'url' | 'richtext' | 'none';

interface SanitizedFormConfig {
  [fieldName: string]: SanitizationType;
}

interface UseSanitizedFormOptions {
  form?: any;
  sanitizationConfig?: SanitizedFormConfig;
  onValuesChange?: (changedValues: any, allValues: any) => void;
}

/**
 * Custom hook for handling forms with automatic input sanitization
 * 
 * @param options Configuration options for the sanitized form
 * @returns Object containing form utilities and sanitization functions
 */
export const useSanitizedForm = (options: UseSanitizedFormOptions = {}) => {
  const { form, sanitizationConfig = {}, onValuesChange } = options;
  const [formInstance] = Form.useForm(form);

  // Sanitization function mapper
  const sanitizationFunctions = useMemo(() => ({
    input: sanitizeInput,
    name: sanitizeName,
    email: sanitizeEmail,
    form: sanitizeFormInput,
    url: sanitizeUrl,
    richtext: sanitizeRichText,
    none: (value: string) => value,
  }), []);

  /**
   * Sanitizes a single field value based on its configuration
   */
  const sanitizeField = useCallback((fieldName: string, value: any): any => {
    if (typeof value !== 'string') return value;
    
    const sanitizationType = sanitizationConfig[fieldName] || 'form';
    const sanitizeFunction = sanitizationFunctions[sanitizationType];
    
    return sanitizeFunction(value);
  }, [sanitizationConfig, sanitizationFunctions]);

  /**
   * Sanitizes all form values
   */
  const sanitizeFormValues = useCallback((values: any): any => {
    const sanitizedValues: any = {};
    
    for (const [key, value] of Object.entries(values)) {
      sanitizedValues[key] = sanitizeField(key, value);
    }
    
    return sanitizedValues;
  }, [sanitizeField]);

  /**
   * Enhanced onValuesChange handler with sanitization
   */
  const handleValuesChange = useCallback((changedValues: any, allValues: any) => {
    // Sanitize changed values
    const sanitizedChangedValues: any = {};
    for (const [key, value] of Object.entries(changedValues)) {
      sanitizedChangedValues[key] = sanitizeField(key, value);
    }

    // Update form with sanitized values if they differ
    const hasChanges = Object.keys(sanitizedChangedValues).some(key => 
      sanitizedChangedValues[key] !== changedValues[key]
    );

    if (hasChanges) {
      formInstance.setFieldsValue(sanitizedChangedValues);
    }

    // Call original onValuesChange if provided
    if (onValuesChange) {
      const sanitizedAllValues = sanitizeFormValues(allValues);
      onValuesChange(sanitizedChangedValues, sanitizedAllValues);
    }
  }, [sanitizeField, sanitizeFormValues, formInstance, onValuesChange]);

  /**
   * Enhanced form submission handler with sanitization
   */
  const handleSubmit = useCallback(async (onFinish: (values: any) => void | Promise<void>) => {
    try {
      const values = await formInstance.validateFields();
      const sanitizedValues = sanitizeFormValues(values);
      
      // Validate that required fields are not empty after sanitization
      const emptyFields: string[] = [];
      for (const [key, value] of Object.entries(sanitizedValues)) {
        if (typeof value === 'string' && !value.trim()) {
          emptyFields.push(key);
        }
      }

      if (emptyFields.length > 0) {
        throw new Error(`The following fields are invalid after sanitization: ${emptyFields.join(', ')}`);
      }

      await onFinish(sanitizedValues);
    } catch (error) {
      console.error('Form submission error:', error);
      throw error;
    }
  }, [formInstance, sanitizeFormValues]);

  /**
   * Validates and sanitizes a specific field
   */
  const validateAndSanitizeField = useCallback(async (fieldName: string) => {
    try {
      const value = formInstance.getFieldValue(fieldName);
      const sanitizedValue = sanitizeField(fieldName, value);
      
      if (sanitizedValue !== value) {
        formInstance.setFieldValue(fieldName, sanitizedValue);
      }
      
      await formInstance.validateFields([fieldName]);
      return sanitizedValue;
    } catch (error) {
      throw error;
    }
  }, [formInstance, sanitizeField]);

  /**
   * Sets field value with automatic sanitization
   */
  const setSanitizedFieldValue = useCallback((fieldName: string, value: any) => {
    const sanitizedValue = sanitizeField(fieldName, value);
    formInstance.setFieldValue(fieldName, sanitizedValue);
  }, [formInstance, sanitizeField]);

  /**
   * Sets multiple field values with automatic sanitization
   */
  const setSanitizedFieldsValue = useCallback((values: any) => {
    const sanitizedValues = sanitizeFormValues(values);
    formInstance.setFieldsValue(sanitizedValues);
  }, [formInstance, sanitizeFormValues]);

  return {
    form: formInstance,
    sanitizeField,
    sanitizeFormValues,
    handleValuesChange,
    handleSubmit,
    validateAndSanitizeField,
    setSanitizedFieldValue,
    setSanitizedFieldsValue,
  };
};

/**
 * Predefined sanitization configurations for common form types
 */
export const FORM_SANITIZATION_CONFIGS = {
  // User registration/profile forms
  userForm: {
    name: 'name' as SanitizationType,
    firstName: 'name' as SanitizationType,
    lastName: 'name' as SanitizationType,
    email: 'email' as SanitizationType,
    password: 'form' as SanitizationType,
    confirmPassword: 'form' as SanitizationType,
    phone: 'form' as SanitizationType,
    website: 'url' as SanitizationType,
    bio: 'form' as SanitizationType,
  },
  
  // Project/team forms
  projectForm: {
    name: 'name' as SanitizationType,
    title: 'name' as SanitizationType,
    description: 'richtext' as SanitizationType,
    url: 'url' as SanitizationType,
    repository: 'url' as SanitizationType,
  },
  
  // Task forms
  taskForm: {
    name: 'name' as SanitizationType,
    title: 'name' as SanitizationType,
    description: 'richtext' as SanitizationType,
    notes: 'richtext' as SanitizationType,
  },
  
  // Comment forms
  commentForm: {
    content: 'richtext' as SanitizationType,
    message: 'richtext' as SanitizationType,
  },
  
  // Settings forms
  settingsForm: {
    organizationName: 'name' as SanitizationType,
    teamName: 'name' as SanitizationType,
    companyName: 'name' as SanitizationType,
    website: 'url' as SanitizationType,
    email: 'email' as SanitizationType,
  },
} as const; 