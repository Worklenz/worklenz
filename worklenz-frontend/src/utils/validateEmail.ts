export const validateEmail = (email: string): boolean => {
  if (!email) return false;

  // Check if the email has basic format with @ and domain part
  if (!email.includes('@') || email.endsWith('@') || email.split('@').length !== 2) {
    return false;
  }

  const EMAIL_REGEXP =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return EMAIL_REGEXP.test(email);
};
