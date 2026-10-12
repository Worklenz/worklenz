/** `published_at` is a plain `YYYY-MM-DD` string; format it as "Month DD, YYYY"
 * without pulling in a date library. Parsed at local midnight to avoid the
 * UTC-vs-local off-by-one day that `new Date('YYYY-MM-DD')` alone can cause. */
export const formatReleaseDate = (isoDate: string): string =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
