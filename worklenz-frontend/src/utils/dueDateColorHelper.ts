import dayjs, { Dayjs } from 'dayjs';

export type DueDateStatus = 'overdue' | 'today' | 'tomorrow' | 'upcoming';

/**
 * Determines the status of a due date relative to today
 * @param dueDate - The due date to check (string or Dayjs)
 * @returns The status of the due date
 */
export const getDueDateStatus = (
  dueDate: string | Dayjs | null | undefined
): DueDateStatus | null => {
  if (!dueDate) return null;

  const date = (typeof dueDate === 'string' ? dayjs(dueDate) : dueDate).startOf('day');
  const today = dayjs().startOf('day');
  const tomorrow = today.add(1, 'day');

  if (date.isBefore(today)) {
    return 'overdue';
  } else if (date.isSame(today)) {
    return 'today';
  } else if (date.isSame(tomorrow)) {
    return 'tomorrow';
  } else {
    return 'upcoming';
  }
};

/**
 * Gets Tailwind CSS classes for due date status with theme support
 * @param status - The due date status
 * @param isDarkMode - Whether dark mode is active
 * @returns Tailwind CSS classes for text color
 */
export const getDueDateColorClass = (
  status: DueDateStatus | null,
  isDarkMode: boolean = false
): string => {
  if (!status) return '';

  switch (status) {
    case 'overdue':
      return isDarkMode ? 'text-red-400' : 'text-red-600';
    case 'today':
    case 'tomorrow':
      return isDarkMode ? 'text-green-400' : 'text-green-600';
    case 'upcoming':
    default:
      return '';
  }
};

/**
 * Gets inline style color for due date status (for components that don't support Tailwind)
 * @param status - The due date status
 * @returns Hex color code
 */
export const getDueDateColor = (status: DueDateStatus | null): string | undefined => {
  if (!status) return undefined;

  switch (status) {
    case 'overdue':
      return '#ff4d4f'; // Ant Design red-5
    case 'today':
    case 'tomorrow':
      return '#52c41a'; // Ant Design green-6
    case 'upcoming':
    default:
      return undefined;
  }
};

/**
 * Gets ARIA label for due date status for accessibility
 * @param status - The due date status
 * @returns Accessible label text
 */
export const getDueDateAriaLabel = (status: DueDateStatus | null): string => {
  if (!status) return '';

  switch (status) {
    case 'overdue':
      return 'Overdue task';
    case 'today':
      return 'Due today';
    case 'tomorrow':
      return 'Due tomorrow';
    case 'upcoming':
      return 'Upcoming task';
    default:
      return '';
  }
};
