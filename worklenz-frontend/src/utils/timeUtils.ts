import dayjs from 'dayjs';

export function formatDate(date: Date | string): string {
  // Handle ISO date strings (YYYY-MM-DD) as local dates to avoid timezone issues
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    return dayjs(localDate).format('MMM DD, YYYY');
  }
  return dayjs(date).format('MMM DD, YYYY');
}

export function buildTimeString(hours: number, minutes: number, seconds: number) {
  const h = hours > 0 ? `${hours}h` : '';
  const m = `${minutes}m`;
  const s = `${seconds}s`;
  return `${h} ${m} ${s}`.trim();
}
