import { parsePhoneNumber, CountryCode } from 'libphonenumber-js';

export const validatePhoneNumber = (phone: string, country?: CountryCode): boolean => {
  if (!phone || phone.trim() === '') return true; // Optional field

  // Use libphonenumber-js for robust international phone validation
  try {
    const phoneNumber = country
      ? parsePhoneNumber(phone.trim(), country)
      : parsePhoneNumber(phone.trim());
    return phoneNumber ? phoneNumber.isValid() : false;
  } catch (error) {
    // If parsing fails, the number is invalid
    return false;
  }
};
