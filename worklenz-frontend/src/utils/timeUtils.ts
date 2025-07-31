import dayjs from 'dayjs';

export function formatDate(date: Date): string {
  return dayjs(date).format('MMM DD, YYYY');
}

export function buildTimeString(hours: number, minutes: number, seconds: number) {
  const h = hours > 0 ? `${hours}h` : '';
  const m = `${minutes}m`;
  const s = `${seconds}s`;
  return `${h} ${m} ${s}`.trim();
}
