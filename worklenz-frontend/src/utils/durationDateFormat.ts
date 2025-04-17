export const durationDateFormat = (date: Date | null | string | undefined): string => {
  if (!date) return '-';

  const givenDate = new Date(date);
  const currentDate = new Date();

  const diffInMilliseconds = currentDate.getTime() - givenDate.getTime();

  const diffInDays = Math.floor(diffInMilliseconds / (1000 * 60 * 60 * 24));
  const diffInMonths =
    currentDate.getMonth() -
    givenDate.getMonth() +
    12 * (currentDate.getFullYear() - givenDate.getFullYear());
  const diffInYears = currentDate.getFullYear() - givenDate.getFullYear();

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
