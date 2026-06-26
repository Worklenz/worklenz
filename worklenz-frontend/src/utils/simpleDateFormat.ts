export const simpleDateFormat = (date: Date | string | null): string => {
  if (!date) return '';

  let dateObj: Date;

  // Handle ISO date strings to avoid timezone issues
  if (typeof date === 'string') {
    // Check if it's an ISO date string (YYYY-MM-DD)
    const isoDateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDateMatch) {
      // Parse as local date to avoid UTC conversion (e.g., "2024-02-10" stays as Feb 10)
      const [, year, month, day] = isoDateMatch;
      dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      // For timestamps or other formats, use standard Date constructor
      dateObj = new Date(date);
    }
  } else {
    dateObj = date;
  }

  // check if the date is valid
  if (isNaN(dateObj.getTime())) return '';

  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  };

  const currentYear = new Date().getFullYear();
  const inputYear = dateObj.getFullYear();

  // add year to the format if it's not the current year
  if (inputYear !== currentYear) {
    options.year = 'numeric';
  }

  return new Intl.DateTimeFormat('en-US', options).format(dateObj);
};
