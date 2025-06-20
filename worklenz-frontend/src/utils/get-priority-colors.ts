import { TaskPriorityType } from '../types/task.types';

type ThemeMode = 'light' | 'dark';

const priorityColors = {
  light: {
    low: '#c2e4d0',
    medium: '#f9e3b1',
    high: '#f6bfc0',
  },
  dark: {
    low: '#75c997',
    medium: '#fbc84c',
    high: '#f37070',
  },
};

export const getPriorityColor = (priority: string, themeMode: ThemeMode): string => {
  const colors = priorityColors[themeMode];
  return colors[priority as TaskPriorityType];
};
