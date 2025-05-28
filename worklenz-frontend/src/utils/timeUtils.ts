import dayjs from 'dayjs';

export function formatDate(date: Date): string {
  return dayjs(date).format('MMM DD, YYYY');
}

export function parseTimeToSeconds(timeString: string): number {
  if (!timeString || timeString === "0s") return 0;
  
  let totalSeconds = 0;
  const hourMatch = timeString.match(/(\d+)h/);
  const minuteMatch = timeString.match(/(\d+)m/);
  const secondMatch = timeString.match(/(\d+)s/);
  
  if (hourMatch) totalSeconds += parseInt(hourMatch[1]) * 3600;
  if (minuteMatch) totalSeconds += parseInt(minuteMatch[1]) * 60;
  if (secondMatch) totalSeconds += parseInt(secondMatch[1]);
  
  return totalSeconds;
}

export function buildTimeString(hours: number, minutes: number, seconds: number) {
  const h = hours > 0 ? `${hours}h` : '';
  const m = `${minutes}m`;
  const s = `${seconds}s`;
  return `${h} ${m} ${s}`.trim();
}

