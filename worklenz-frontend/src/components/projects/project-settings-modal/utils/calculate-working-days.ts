import dayjs from 'dayjs';

/** Number of weekdays (Mon-Fri) between two dates, inclusive. */
export const calculateWorkingDays = (
  startDate: dayjs.Dayjs | string | null | undefined,
  endDate: dayjs.Dayjs | string | null | undefined
): number => {
  if (!startDate || !endDate) return 0;

  const start = dayjs.isDayjs(startDate) ? startDate : dayjs(startDate);
  const end = dayjs.isDayjs(endDate) ? endDate : dayjs(endDate);

  if (!start.isValid() || !end.isValid()) return 0;
  if (start.isAfter(end)) return 0;

  let workingDays = 0;
  let currentDate = start.clone().startOf('day');
  const endDateNormalized = end.clone().startOf('day');

  while (currentDate.isBefore(endDateNormalized) || currentDate.isSame(endDateNormalized)) {
    const dayOfWeek = currentDate.day();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
    currentDate = currentDate.add(1, 'day');
  }

  return workingDays;
};
