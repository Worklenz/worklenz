export function toQueryString(obj: any, opts?: { arrayFormat?: 'brackets' }) {
  const query = [];
  for (const key in obj) {
    const value = obj[key];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (opts?.arrayFormat === 'brackets') {
        // Repeated key[]=value entries — Express's default qs parser
        // reassembles these into a real array server-side. Opt-in only:
        // most existing callers' backend parsers expect the comma-joined
        // string form below instead (e.g. reporting's `date_range`).
        for (const item of value) {
          query.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(item)}`);
        }
      } else {
        // Array#join(',') — matches the old encodeURIComponent(arr) behavior,
        // which coerced via Array#toString() (itself a comma-join).
        query.push(`${encodeURIComponent(key)}=${encodeURIComponent(value.join(','))}`);
      }
    } else {
      query.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  return '?' + query.join('&');
}
