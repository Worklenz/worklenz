import { message } from 'antd';
import apiClient from '@/api/api-client';

const parseFilename = (contentDisposition: unknown, fallback: string): string => {
  if (typeof contentDisposition !== 'string') return fallback;
  const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
  return match?.[1] ? decodeURIComponent(match[1]) : fallback;
};

/**
 * Fetches a PDF through the authenticated API client and saves it as a file, instead of opening
 * the endpoint in a new tab (where a failure shows up as a raw JSON page). On failure it shows
 * `failureMessage` and resolves to false; it never throws.
 */
export const downloadPortalPdf = async (
  url: string,
  fallbackFilename: string,
  failureMessage: string
): Promise<boolean> => {
  try {
    const response = await apiClient.get<Blob>(url, {
      responseType: 'blob',
      // The caller shows the failure toast itself, so the interceptor must not add a second one.
      headers: { 'X-Silent-Request': '1' },
    });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = parseFilename(response.headers?.['content-disposition'], fallbackFilename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoke on the next tick so the browser has started the download.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    return true;
  } catch {
    message.error(failureMessage);
    return false;
  }
};
