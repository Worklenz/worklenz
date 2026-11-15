const SHOW_WEEKENDS_KEY_PREFIX = 'worklenz.schedule.showWeekends';

const keyFor = (userId?: string) => `${SHOW_WEEKENDS_KEY_PREFIX}:${userId || 'anonymous'}`;

export const loadShowWeekendsPreference = (userId?: string): boolean => {
  try {
    return localStorage.getItem(keyFor(userId)) === 'true';
  } catch (error) {
    console.warn('Failed to load schedule preferences from localStorage:', error);
    return false;
  }
};

export const saveShowWeekendsPreference = (
  userId: string | undefined,
  showWeekends: boolean
): void => {
  try {
    localStorage.setItem(keyFor(userId), String(showWeekends));
  } catch (error) {
    console.warn('Failed to save schedule preferences to localStorage:', error);
  }
};
