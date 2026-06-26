export const durationDateFormat = (date: Date | null | string | undefined): string => {
  if (!date) return '-';

  let givenDate: Date;

  // Handle different input types and parse ISO date strings as local dates
  if (typeof date === 'string') {
    // Check if it's an ISO date string (YYYY-MM-DD format)
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split('-').map(Number);
      givenDate = new Date(year, month - 1, day);
    } else {
      // ISO timestamp or other format - parse normally
      givenDate = new Date(date);
    }
  } else {
    givenDate = date;
  }

  const currentDate = new Date();

  // Normalize both dates to the start of their respective local days
  const startOfGivenDate = new Date(
    givenDate.getFullYear(),
    givenDate.getMonth(),
    givenDate.getDate()
  );

  const startOfCurrentDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate()
  );

  const diffInMilliseconds = startOfCurrentDate.getTime() - startOfGivenDate.getTime();

  const diffInDays = Math.floor(diffInMilliseconds / (1000 * 60 * 60 * 24));
  const diffInMonths =
    startOfCurrentDate.getMonth() -
    startOfGivenDate.getMonth() +
    12 * (startOfCurrentDate.getFullYear() - startOfGivenDate.getFullYear());
  const diffInYears = startOfCurrentDate.getFullYear() - startOfGivenDate.getFullYear();

  if (diffInYears > 0) {
    return diffInYears === 1 ? '1 year ago' : `${diffInYears} years ago`;
  } else if (diffInMonths > 0) {
    return diffInMonths === 1 ? '1 month ago' : `${diffInMonths} months ago`;
  } else if (diffInDays > 0) {
    return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
  } else {
    return 'Today';
  }
};
