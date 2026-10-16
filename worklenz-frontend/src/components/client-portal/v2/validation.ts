const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmailAddress = (value: string): boolean => EMAIL_PATTERN.test(value.trim());
