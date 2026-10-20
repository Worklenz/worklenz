import { signupEmailDomainPolicy } from "./private-extensions";

export const BLOCKED_SIGNUP_EMAIL_MESSAGE = "This email provider is not supported. Please use a business email address.";

/**
 * Signup domain blocking is an optional extension: without src/private/ it never blocks.
 */
export const isSignupEmailDomainBlocked = (email: string): Promise<boolean> =>
  signupEmailDomainPolicy.isBlocked(email);
