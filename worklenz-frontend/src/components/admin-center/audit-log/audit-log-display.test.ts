import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import type { TFunction } from 'i18next';
import { getFileNameFromDisposition } from '@/api/admin-center/audit-log.api.service';
import {
  formatRelativeDay,
  formatRetentionMonths,
  getCategoryLabel,
  getEventLabel,
  getInitials,
  humanizeEventType,
} from './audit-log-display';

const t = ((key: string, options?: Record<string, unknown> & { defaultValue?: string }) =>
  String(options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(options?.[name] ?? '')
  )) as unknown as TFunction;

const NOW = dayjs('2026-10-06T09:00:00');

describe('audit log display helpers', () => {
  it('labels known categories and event types from the shared catalog', () => {
    expect(getCategoryLabel(t, 'access')).toBe('Access & Authentication');
    expect(getEventLabel(t, 'role_changed')).toBe('Role changed');
  });

  it('humanizes event types this build does not know yet', () => {
    expect(getEventLabel(t, 'sso_config_changed')).toBe('Sso config changed');
    expect(humanizeEventType('api_token_created')).toBe('Api token created');
  });

  it('builds up to two initials', () => {
    expect(getInitials('Gayan Thakshila')).toBe('GT');
    expect(getInitials('chamika')).toBe('C');
    expect(getInitials('Ruwan Kumar Perera')).toBe('RK');
    expect(getInitials('  ')).toBe('?');
  });

  it('describes the day relative to today', () => {
    expect(formatRelativeDay(t, '2026-10-06T08:00:00', NOW)).toBe('Today');
    expect(formatRelativeDay(t, '2026-10-05T23:59:00', NOW)).toBe('Yesterday');
    expect(formatRelativeDay(t, '2026-09-21T10:00:00', NOW)).toBe('15 days ago');
  });

  it('formats retention in months', () => {
    expect(formatRetentionMonths(t, 12)).toBe('12 months');
  });
});

describe('getFileNameFromDisposition', () => {
  it('reads the filename from Content-Disposition', () => {
    expect(getFileNameFromDisposition('attachment; filename="audit-log-export-2026-10-06.csv"')).toBe(
      'audit-log-export-2026-10-06.csv'
    );
  });

  it('falls back to a dated name when the header is missing', () => {
    expect(getFileNameFromDisposition(null)).toMatch(/^audit-log-export-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
