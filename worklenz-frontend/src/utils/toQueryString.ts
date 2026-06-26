export function toQueryString(obj: any) {
  const query = [];
  for (const key in obj) {
    if (obj[key] !== undefined && obj[key] !== null) {
      query.push(`${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`);
    }
  }
  return '?' + query.join('&');
}
