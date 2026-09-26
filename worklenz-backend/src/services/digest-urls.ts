import { getBaseUrl } from "../cron_jobs/helpers";

export const buildUnsubscribeUrl = (token: string): string => {
  return `${getBaseUrl()}/public/digest/unsubscribe?token=${encodeURIComponent(token)}`;
};

export const buildManagePreferencesUrl = (): string => {
  return `${getBaseUrl()}/worklenz/settings/notifications`;
};

export const buildViewAllTasksUrl = (): string => {
  return `${getBaseUrl()}/worklenz/my-tasks`;
};
