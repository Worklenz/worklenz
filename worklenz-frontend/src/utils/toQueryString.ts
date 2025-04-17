export function toQueryString(obj: any) {
  const query = [];
  for (const key in obj) {
    if (typeof obj[key] !== undefined && obj[key] !== null) {
      query.push(`${key}=${obj[key]}`);
    }
  }
  return '?' + query.join('&');
}
