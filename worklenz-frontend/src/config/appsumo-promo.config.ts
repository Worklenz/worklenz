const APPSUMO_POPUP_LAST_SHOWN_KEY = 'appsumo-popup-last-shown';
const DEFAULT_APPSUMO_POPUP_FREQUENCY_DAYS = 1;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const APPSUMO_POPUP_IMAGE_URL =
  'https://s3.dualstack.us-west-2.amazonaws.com/worklenz.com/appsumo-promo/worklenz-appusumo-70-discount-promo.webp';
export const APPSUMO_DRAWER_IMAGE_URL = APPSUMO_POPUP_IMAGE_URL;

/**
 * True if the AppSumo popup was shown more recently than `frequencyDays` ago.
 * `frequencyDays` comes from the backend (`user.appsumo_popup_frequency_days`
 * on /secure/verify) so ops can tune the cadence without a frontend deploy;
 * falls back to once-per-day if the backend hasn't provided a value.
 */
export const hasAppSumoPopupBeenShownRecently = (
  frequencyDays: number = DEFAULT_APPSUMO_POPUP_FREQUENCY_DAYS
): boolean => {
  try {
    const raw = localStorage.getItem(APPSUMO_POPUP_LAST_SHOWN_KEY);
    if (!raw) return false;

    // Pre-existing values were stamped as `Date().toDateString()` rather than
    // epoch ms — fall back to Date.parse so a dismissal recorded just before
    // this change shipped isn't treated as never having happened.
    const lastShownAt = Number(raw) || Date.parse(raw);
    if (!Number.isFinite(lastShownAt)) return false;

    const effectiveFrequencyDays =
      Number.isFinite(frequencyDays) && frequencyDays > 0
        ? frequencyDays
        : DEFAULT_APPSUMO_POPUP_FREQUENCY_DAYS;

    return Date.now() - lastShownAt < effectiveFrequencyDays * MS_PER_DAY;
  } catch {
    return false;
  }
};

/**
 * Stamps the current time so the popup won't be shown again until the
 * configured frequency has elapsed.
 */
export const markAppSumoPopupShown = (): void => {
  try {
    localStorage.setItem(APPSUMO_POPUP_LAST_SHOWN_KEY, String(Date.now()));
  } catch {
    // Ignore localStorage errors
  }
};
