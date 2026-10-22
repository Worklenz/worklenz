/** Normalize web links while keeping executable and unsupported schemes out of documents. */
export const normalizeDocsLink = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed);
  if (hasScheme && !/^https?:\/\//i.test(trimmed)) return null;
  if (!hasScheme && !/^[^/]+\.[^/]+/.test(trimmed)) return null;
  try {
    const url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
    if (!url.hostname || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
};
