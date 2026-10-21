import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { IAuditLogEvent } from '@/types/admin-center/audit-log.types';
import { AuditLogTable } from './AuditLogTable';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown> & { defaultValue?: string }) =>
      String(options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
        String(options?.[name] ?? '')
      ),
  }),
}));

const makeEvent = (overrides: Partial<IAuditLogEvent> = {}): IAuditLogEvent => ({
  id: 'evt-1',
  created_at: '2026-10-06T09:42:00.000Z',
  actor_user_id: 'u1',
  actor_name: 'Chamika Perera',
  category: 'permission',
  event_type: 'project_privacy_changed',
  description: '"Restrict members to assigned tasks" on Core Ledger Migration',
  old_value: 'Off',
  new_value: 'On',
  team_id: 't1',
  actor_in_workspace: true,
  ...overrides,
});

const renderTable = (props: Partial<React.ComponentProps<typeof AuditLogTable>> = {}) => {
  const handlers = { onPageChange: vi.fn(), onRetry: vi.fn(), onClearFilters: vi.fn() };
  render(
    <AuditLogTable
      events={[makeEvent()]}
      total={1}
      page={1}
      pageSize={20}
      loading={false}
      failed={false}
      hasActiveFilters={false}
      {...handlers}
      {...props}
    />
  );
  return handlers;
};

describe('AuditLogTable', () => {
  it('renders the Timestamp, Actor, Category, Event and Details columns', () => {
    renderTable();
    ['Timestamp', 'Actor', 'Category', 'Event', 'Details'].forEach(title =>
      expect(screen.getByRole('columnheader', { name: title })).toBeInTheDocument()
    );
  });

  it('shows the category, event and old → new values of a change', () => {
    renderTable();
    expect(screen.getByText('Permission & Settings Changes')).toBeInTheDocument();
    expect(screen.getByText('Project privacy changed')).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
    expect(screen.getByText('On')).toBeInTheDocument();
    expect(screen.getByLabelText('Changed from Off to On')).toBeInTheDocument();
  });

  it('flags failed logins and actors who have left the workspace', () => {
    renderTable({
      events: [makeEvent({ event_type: 'login_failed', category: 'access', actor_in_workspace: false, old_value: null, new_value: null })],
    });
    expect(screen.getByText('FAILED')).toBeInTheDocument();
    expect(screen.getByText('removed from workspace')).toBeInTheDocument();
  });

  it('does not mark system or deleted actors (no user id) as removed', () => {
    renderTable({ events: [makeEvent({ actor_user_id: null, actor_in_workspace: false })] });
    expect(screen.queryByText('removed from workspace')).not.toBeInTheDocument();
  });

  it('offers no edit, delete or selection affordance on any row (task 7.9)', () => {
    renderTable({ events: [makeEvent({ id: 'a' }), makeEvent({ id: 'b', old_value: null, new_value: null })] });
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    rows.forEach(row => {
      expect(within(row).queryByRole('button')).not.toBeInTheDocument();
      expect(within(row).queryByRole('checkbox')).not.toBeInTheDocument();
      expect(within(row).queryByRole('link')).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/edit|delete|remove entry/i)).not.toBeInTheDocument();
  });

  it('explains an empty log', () => {
    renderTable({ events: [], total: 0 });
    expect(screen.getByText('No audit events yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('offers to clear filters when filters hide every event', () => {
    const { onClearFilters } = renderTable({ events: [], total: 0, hasActiveFilters: true });
    expect(screen.getByText('No events match the current filters')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('shows a retry instead of the table when loading failed', () => {
    const { onRetry } = renderTable({ failed: true });
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load the audit log");
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
