import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getUserSession } from '@/utils/session-helper';
import { getAnalyticsCustomReportsStorageKey, syncTemplatesToCustomReports } from './analytics-custom-reports';
import type { AnalyticsReportTemplate } from '@/types/reporting/analytics-velocity.types';

vi.mock('@/utils/session-helper', () => ({ getUserSession: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuthService: vi.fn() }));
vi.mock('@/lib/reporting/analytics-nav', () => ({ flatAnalyticsNavItems: () => [] }));

describe('template cache session isolation', () => {
  beforeEach(() => localStorage.clear());

  it('discards a response when the team or user changes mid-request', () => {
    const originalKey = getAnalyticsCustomReportsStorageKey('old-team', 'old-user');
    const activeKey = getAnalyticsCustomReportsStorageKey('new-team', 'new-user');
    vi.mocked(getUserSession).mockReturnValue({ team_id: 'new-team', id: 'new-user' } as ReturnType<typeof getUserSession>);
    syncTemplatesToCustomReports([{ id: 'private-template' } as AnalyticsReportTemplate], originalKey);
    expect(localStorage.getItem(originalKey)).toBeNull();
    expect(localStorage.getItem(activeKey)).toBeNull();
  });
});
