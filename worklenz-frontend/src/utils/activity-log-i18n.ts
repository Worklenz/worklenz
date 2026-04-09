/**
 * Utility functions for handling internationalized activity logs
 */

export interface ActivityLogItem {
  description: string;
  i18n_key?: string;
  i18n_params?: Record<string, any>;
  user_name?: string;
  project_name: string;
  created_at: string;
  project_id: string;
  project_deleted: boolean;
}

/**
 * Renders an activity log message with i18n support
 * Falls back to the original description if i18n fails
 */
export const renderActivityMessage = (
  item: ActivityLogItem,
  translateFunction: (key: string, options?: any) => string
): string => {
  // If we have an i18n key, use it with parameters
  if (item.i18n_key && item.i18n_params) {
    try {
      return translateFunction(item.i18n_key, {
        ...item.i18n_params,
        defaultValue: item.description, // Fallback to original description
      });
    } catch (error) {
      console.warn('Failed to translate activity log:', error);
      return item.description;
    }
  }

  // Fallback to original description for backward compatibility
  return item.description;
};

/**
 * Checks if an activity log item has i18n support
 */
export const hasI18nSupport = (item: ActivityLogItem): boolean => {
  return !!(item.i18n_key && item.i18n_params);
};

/**
 * Gets the user name from activity log item (preferring cached user_name over params)
 */
export const getActivityUserName = (item: ActivityLogItem): string => {
  if (item.user_name) {
    return item.user_name;
  }

  if (item.i18n_params?.userName) {
    return item.i18n_params.userName;
  }

  return 'Unknown User';
};

/**
 * Gets the project name from activity log item (preferring cached project_name over params)
 */
export const getActivityProjectName = (item: ActivityLogItem): string => {
  if (item.project_name) {
    return item.project_name;
  }

  if (item.i18n_params?.projectName) {
    return item.i18n_params.projectName;
  }

  return 'Unknown Project';
};
