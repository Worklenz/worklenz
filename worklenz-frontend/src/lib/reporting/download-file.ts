/**
 * Trigger a browser file download from a Blob.
 * The anchor must be attached to the document — detached `<a>.click()` is
 * unreliable after the first download in Chromium, so later PNG/SVG/CSV
 * exports appear to do nothing.
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Delay revoke so the browser can finish starting the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

export const downloadText = (content: string, filename: string, mime: string): void => {
  downloadBlob(new Blob([content], { type: mime }), filename);
};
