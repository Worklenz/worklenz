/**
 * Survey Configuration
 *
 * This file contains configuration for the survey popup behavior,
 * including route exclusions, frequency caps, and localStorage keys.
 */

// Routes where the survey popup should NEVER appear (conversion-critical pages)
export const SURVEY_EXCLUDED_ROUTES: string[] = [
  // Pricing and billing related routes
  '/worklenz/admin-center/billing',
  '/pricing',
  '/checkout',
  '/payment',
  // Account setup routes (user is already in onboarding flow)
  '/account-setup',
  // Auth routes
  '/auth',
  '/login',
  '/signup',
  '/register',
  // License related
  '/worklenz/license-expired',
  // Unauthorized
  '/worklenz/unauthorized',
];

// Routes where the survey popup IS allowed to appear
export const SURVEY_ALLOWED_ROUTES: string[] = ['/worklenz/home', '/worklenz/projects'];

// LocalStorage keys for survey state management
export const SURVEY_STORAGE_KEYS = {
  // Timestamp when user skipped the survey (for frequency cap)
  SKIPPED_AT: 'survey_skipped_at',
  // Flag for permanent dismissal
  PERMANENTLY_DISMISSED: 'survey_permanently_dismissed',
  // Count of times survey has been shown
  SHOW_COUNT: 'survey_show_count',
  // Last shown timestamp
  LAST_SHOWN_AT: 'survey_last_shown_at',
} as const;

// Survey frequency configuration
export const SURVEY_FREQUENCY_CONFIG = {
  // Minimum days between showing survey after skip (frequency cap)
  DAYS_BETWEEN_SHOWS: 7,
  // Delay in milliseconds before showing survey on page load
  INITIAL_DELAY_MS: 5000,
  // Maximum number of times to show survey before auto-permanent-dismiss
  MAX_SHOW_COUNT: 3,
} as const;

// Modal z-index to avoid conflicts with other modals
export const SURVEY_MODAL_Z_INDEX = 1050;

/**
 * Check if the current route is excluded from showing the survey
 * @param pathname - Current route pathname
 * @returns true if the route is excluded (survey should NOT show)
 */
export const isRouteExcluded = (pathname: string): boolean => {
  // Check if pathname starts with any excluded route
  return SURVEY_EXCLUDED_ROUTES.some(
    excludedRoute => pathname.startsWith(excludedRoute) || pathname === excludedRoute
  );
};

/**
 * Check if the current route is in the allowed list for showing the survey
 * @param pathname - Current route pathname
 * @returns true if the route is explicitly allowed
 */
export const isRouteAllowed = (pathname: string): boolean => {
  return SURVEY_ALLOWED_ROUTES.some(
    allowedRoute => pathname === allowedRoute || pathname.startsWith(allowedRoute + '/')
  );
};

/**
 * Check if the survey has been permanently dismissed by the user
 * @returns true if permanently dismissed
 */
export const isSurveyPermanentlyDismissed = (): boolean => {
  try {
    return localStorage.getItem(SURVEY_STORAGE_KEYS.PERMANENTLY_DISMISSED) === 'true';
  } catch {
    return false;
  }
};

/**
 * Set permanent dismissal flag
 */
export const setSurveyPermanentlyDismissed = (): void => {
  try {
    localStorage.setItem(SURVEY_STORAGE_KEYS.PERMANENTLY_DISMISSED, 'true');
  } catch {
    // Ignore localStorage errors
  }
};

/**
 * Check if enough time has passed since the last skip (frequency cap)
 * @returns true if the survey can be shown (enough time has passed)
 */
export const hasFrequencyCapPassed = (): boolean => {
  try {
    const skippedAt = localStorage.getItem(SURVEY_STORAGE_KEYS.SKIPPED_AT);
    if (!skippedAt) return true;

    const skippedDate = new Date(skippedAt);
    const now = new Date();
    const diffDays = (now.getTime() - skippedDate.getTime()) / (1000 * 60 * 60 * 24);

    return diffDays >= SURVEY_FREQUENCY_CONFIG.DAYS_BETWEEN_SHOWS;
  } catch {
    return true;
  }
};

/**
 * Record that the survey was skipped
 */
export const recordSurveySkip = (): void => {
  try {
    localStorage.setItem(SURVEY_STORAGE_KEYS.SKIPPED_AT, new Date().toISOString());

    // Increment show count
    const currentCount = parseInt(localStorage.getItem(SURVEY_STORAGE_KEYS.SHOW_COUNT) || '0', 10);
    localStorage.setItem(SURVEY_STORAGE_KEYS.SHOW_COUNT, String(currentCount + 1));
  } catch {
    // Ignore localStorage errors
  }
};

/**
 * Check if max show count has been reached
 * @returns true if max show count reached (should auto-dismiss permanently)
 */
export const hasReachedMaxShowCount = (): boolean => {
  try {
    const showCount = parseInt(localStorage.getItem(SURVEY_STORAGE_KEYS.SHOW_COUNT) || '0', 10);
    return showCount >= SURVEY_FREQUENCY_CONFIG.MAX_SHOW_COUNT;
  } catch {
    return false;
  }
};

/**
 * Clear all survey-related localStorage items (useful for testing)
 */
export const clearSurveyStorage = (): void => {
  try {
    Object.values(SURVEY_STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch {
    // Ignore localStorage errors
  }
};
