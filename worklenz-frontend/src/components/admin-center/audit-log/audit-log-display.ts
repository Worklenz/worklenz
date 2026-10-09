import dayjs, { Dayjs } from 'dayjs';
import type { TFunction } from 'i18next';
import type { GlobalToken } from 'antd';
import {
  AUDIT_EVENT_CATEGORY_LIST,
  AUDIT_EVENT_TYPE_LIST,
  AuditEventCategoryId,
} from '@/shared/audit-log-constants';

/** antd preset tag colors per category — they adapt to the dark algorithm on their own. */
export const CATEGORY_TAG_COLOR: Record<AuditEventCategoryId, string> = {
  access: 'blue',
  user: 'green',
  permission: 'gold',
  lifecycle: 'red',
};

/** Theme-token colors for the active category chips (blue / green / amber / red in the mockup). */
export const getCategoryTokenColor = (category: AuditEventCategoryId, token: GlobalToken): string =>
  ({
    access: token.colorPrimary,
    user: token.colorSuccess,
    permission: token.colorWarning,
    lifecycle: token.colorError,
  })[category];

/** Short chip labels from the mockup ("Access & Auth", "User & Role", ...). */
const CATEGORY_CHIP_LABELS: Record<AuditEventCategoryId, { key: string; defaultValue: string }> = {
  access: { key: 'chipAccess', defaultValue: 'Access & Auth' },
  user: { key: 'chipUser', defaultValue: 'User & Role' },
  permission: { key: 'chipPermission', defaultValue: 'Permissions' },
  lifecycle: { key: 'chipLifecycle', defaultValue: 'Lifecycle' },
};

export const getCategoryLabel = (t: TFunction, category: string): string => {
  const def = AUDIT_EVENT_CATEGORY_LIST.find(c => c.id === category);
  return def ? t(def.i18nKey, { defaultValue: def.defaultLabel }) : category;
};

export const getCategoryChipLabel = (t: TFunction, category: AuditEventCategoryId): string =>
  t(CATEGORY_CHIP_LABELS[category].key, { defaultValue: CATEGORY_CHIP_LABELS[category].defaultValue });

/** "login_failed" -> "Login failed", for event types newer than this build's catalog. */
export const humanizeEventType = (eventType: string): string => {
  const words = eventType.replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : eventType;
};

export const getEventLabel = (t: TFunction, eventType: string): string => {
  const def = AUDIT_EVENT_TYPE_LIST.find(e => e.id === eventType);
  return def ? t(def.i18nKey, { defaultValue: def.defaultLabel }) : humanizeEventType(eventType);
};

export const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

/** "Today", "Yesterday" or "N days ago" in the viewer's calendar, as the mockup shows under the time. */
export const formatRelativeDay = (t: TFunction, createdAt: string, now: Dayjs = dayjs()): string => {
  const days = now.startOf('day').diff(dayjs(createdAt).startOf('day'), 'day');
  if (days <= 0) return t('relativeToday', { defaultValue: 'Today' });
  if (days === 1) return t('relativeYesterday', { defaultValue: 'Yesterday' });
  return t('relativeDaysAgo', { defaultValue: '{{count}} days ago', count: days });
};

export const formatRetentionMonths = (t: TFunction, months: number): string =>
  t('retentionMonths', { defaultValue: '{{count}} months', count: months });
