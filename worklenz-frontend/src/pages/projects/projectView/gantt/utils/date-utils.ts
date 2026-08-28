// tasks.start_date/end_date are plain DATE columns (no time-of-day). Sending
// Date.toISOString() (always UTC) truncates to that UTC instant's calendar date on the
// way in — for any positive-UTC-offset timezone (e.g. Colombo, +5:30), local midnight is
// still the *previous* day in UTC, silently shifting a task's start back by a day. Format
// from local Y/M/D components instead to avoid any timezone conversion.
export const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
