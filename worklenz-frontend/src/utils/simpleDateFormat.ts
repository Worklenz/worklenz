export const simpleDateFormat = (date: Date | string | null): string => {
  if (!date) return '';

  // convert ISO string date to Date object if necessary
  const dateObj = typeof date === 'string' ? new Date(date) : date;

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
