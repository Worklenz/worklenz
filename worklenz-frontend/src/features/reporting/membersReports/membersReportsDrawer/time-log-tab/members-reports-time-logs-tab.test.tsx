import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MembersReportsTimeLogsTab from './members-reports-time-logs-tab';
import { reportingApiService } from '@/api/reporting/reporting.api.service';

vi.mock('@/shared/antd-imports', () => ({
  Flex: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Skeleton: ({ children, loading }: { children: React.ReactNode; loading: boolean }) =>
    loading ? <div>Loading</div> : <div>{children}</div>,
}));
vi.mock('./billable-filter', () => ({
  default: ({ onBillableChange }: { onBillableChange: (value: object) => void }) => (
    <button onClick={() => onBillableChange({ billable: false, nonBillable: false })}>Clear</button>
  ),
}));
vi.mock('./time-log-card', () => ({ default: () => <div>Old logs</div> }));
vi.mock('../../../../../components/EmptyListPlaceholder', () => ({ default: () => <div>No logs</div> }));
vi.mock('@components/task-drawer/task-drawer', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/hooks/useAppSelector', () => {
  const state = {
    reportingReducer: { duration: 'all', dateRange: [] },
    membersReportsReducer: { archived: false },
  };
  return { useAppSelector: (selector: (state: object) => unknown) => selector(state) };
});
vi.mock('@/hooks/useAuth', () => ({ useAuthService: () => ({ getCurrentSession: () => ({ team_id: 'team' }) }) }));
vi.mock('@/api/reporting/reporting.api.service', () => ({
  reportingApiService: { getSingleMemberTimeLogs: vi.fn() },
}));

describe('member time log filter', () => {
  it('ignores an older response after the filter is cleared', async () => {
    let resolveOld!: (value: unknown) => void;
    const oldRequest = new Promise(resolve => { resolveOld = resolve; });
    vi.mocked(reportingApiService.getSingleMemberTimeLogs)
      .mockReturnValueOnce(oldRequest as ReturnType<typeof reportingApiService.getSingleMemberTimeLogs>)
      .mockResolvedValueOnce({ done: true, body: [] } as never);

    render(<MembersReportsTimeLogsTab memberId="member" />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await screen.findByText('No logs');
    expect(reportingApiService.getSingleMemberTimeLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ billable: { billable: false, nonBillable: false } })
    );
    await act(async () => {
      resolveOld({ done: true, body: [{ log_day: '2026-01-01' }] });
      await oldRequest;
    });
    expect(screen.queryByText('Old logs')).toBeNull();
    expect(screen.getByText('No logs')).toBeTruthy();
  });
});
