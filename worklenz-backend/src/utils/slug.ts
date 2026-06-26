/**
 * Slug Generation Utility
 *
 * Generates URL-safe slugs from text for vanity URLs
 */

/**
 * Convert text to a URL-safe slug
 * @param text - Text to slugify
 * @returns URL-safe slug (lowercase, alphanumeric, hyphens only)
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove special characters except hyphens
    .replace(/[^a-z0-9-]/g, '')
    // Replace multiple consecutive hyphens with single hyphen
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate a unique slug by appending a number if needed
 * @param baseSlug - Base slug to start with
 * @param checkExists - Async function to check if slug exists
 * @returns Unique slug
 */
export async function generateUniqueSlug(
  baseSlug: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  let slug = slugify(baseSlug);
  let counter = 1;

  // Ensure minimum length of 3 characters
  if (slug.length < 3) {
    slug = slug + '-' + Math.random().toString(36).substring(2, 5);
  }

  // Check if slug already exists, append number if needed
  while (await checkExists(slug)) {
    slug = `${slugify(baseSlug)}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Validate slug format
 * @param slug - Slug to validate
 * @returns true if valid slug format
 */
export function isValidSlug(slug: string): boolean {
  if (!slug) return false;
  if (slug.length < 3 || slug.length > 50) return false;
  return /^[a-z0-9-]+$/.test(slug);
}

/**
 * Generate a suggested slug from company/client name
 * @param name - Company or client name
 * @returns Suggested slug
 */
export function suggestSlug(name: string): string {
  const slug = slugify(name);

  // If slug is too short, don't modify it yet
  // The generateUniqueSlug function will handle it
  return slug || 'client';
}
