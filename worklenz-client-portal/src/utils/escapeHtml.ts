/**
 * Escapes HTML special characters to prevent XSS attacks
 * Uses createElement + textContent for safe escaping without external dependencies
 * 
 * @param value - The value to escape (string, undefined, or null)
 * @returns Escaped HTML string (empty string if value is undefined/null)
 * 
 * @example
 * escapeHtml("<script>alert('xss')</script>") // Returns "&lt;script&gt;alert('xss')&lt;/script&gt;"
 * escapeHtml("Hello & World") // Returns "Hello &amp; World"
 * escapeHtml(undefined) // Returns ""
 */
export const escapeHtml = (value: string | undefined | null): string => {
  if (value === undefined || value === null) {
    return "";
  }
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
};

