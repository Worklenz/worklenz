import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../discussions/RichMessageEditor', async () => {
  const { RichMessageEditorStub } = await import('../discussions/richMessageEditorStub');
  return { RichMessageEditor: RichMessageEditorStub };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: Record<string, unknown>) =>
      String(options?.defaultValue ?? '').replace(/{{(\w+)}}/g, (_match, name: string) =>
        String(options?.[name] ?? '')
      ),
    i18n: { language: 'en' },
  }),
}));

const state = vi.hoisted(() => ({
  request: undefined as unknown,
  act: vi.fn(),
  update: vi.fn(),
  convert: vi.fn(),
  linkable: [] as unknown[],
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
  messageWarning: vi.fn(),
  download: vi.fn(),
}));

const trigger =
  (fn: (...args: unknown[]) => unknown) =>
  (...args: unknown[]) => {
    const promise = Promise.resolve().then(() => fn(...args));
    return Object.assign(promise, { unwrap: () => promise });
  };

vi.mock('@/api/client-portal/portal-workflow-api', () => ({
  useGetChangeRequestQuery: () => ({
    data: state.request ? { body: state.request } : undefined,
    isLoading: false,
    isError: false,
    error: undefined,
    refetch: vi.fn(),
  }),
  useApplyChangeRequestActionMutation: () => [trigger(state.act), { isLoading: false }],
  useUpdateChangeRequestMutation: () => [trigger(state.update), { isLoading: false }],
  useConvertChangeRequestMutation: () => [trigger(state.convert), { isLoading: false }],
  useGetLinkableTasksQuery: () => ({ data: { body: state.linkable }, isLoading: false }),
}));

vi.mock('@/api/client-portal/portal-projects-api', () => ({
  useGetFileDownloadLinkMutation: () => [trigger(state.download)],
}));

vi.mock('@/api/client-portal/portal-access-api', () => ({
  useGetPortalStaffQuery: () => ({ data: { body: [{ id: 's-1', name: 'Kim Fernando' }] }, isLoading: false }),
}));

vi.mock('@/shared/antd-imports', async importOriginal => {
  const actual = await importOriginal<typeof import('@/shared/antd-imports')>();
  return {
    ...actual,
    message: {
      success: state.messageSuccess,
      error: state.messageError,
      warning: state.messageWarning,
      info: vi.fn(),
    },
  };
});

import type { ChangeRequest } from '@/types/client-portal/v2';
import { ChangeRequestDetailModal } from './ChangeRequestDetailModal';
import { formatEstimate, getChangeRequestStep, isBillable, isTerminal } from './cr-helpers';

const makeRequest = (overrides: Partial<ChangeRequest> = {}): ChangeRequest => ({
  id: 'cr-1',
  cr_no: 'CR-0048',
  organization_id: 'org-1',
  organization_name: 'Brandbase',
  project_id: 'p-1',
  project_name: 'Website redesign',
  title: 'Add a live chat widget',
  description: 'We would like a chat widget.',
  notes: '',
  attachments: [],
  priority: 'medium',
  requester_id: 'u-1',
  requester_name: 'Jamie Wu',
  submitted_at: '2026-06-01T10:00:00Z',
  updated_at: '2026-06-02T10:00:00Z',
  status: 'under_review',
  assignee: null,
  estimate: null,
  response: '',
  internal_assessment: '',
  linked_work: null,
  messages: [],
  history: [],
  billing: { quotes: [], invoices: [] },
  ...overrides,
});

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={['/change-requests/cr-1']}>
      <Routes>
        <Route path="/change-requests/:changeRequestId" element={<ChangeRequestDetailModal />} />
      </Routes>
    </MemoryRouter>
  );

const openTab = (name: string) => userEvent.click(screen.getByRole('tab', { name }));

beforeEach(() => {
  vi.clearAllMocks();
  state.request = makeRequest();
  state.linkable = [{ id: 't-9', key: 'WL-9', title: 'Existing task' }];
  state.act.mockResolvedValue({ body: {} });
  state.update.mockResolvedValue({ body: {} });
  state.convert.mockResolvedValue({ body: { linked_work: { task_key: 'WL-231' } } });
  state.download.mockResolvedValue({ body: { url: 'https://files.test/brief.pdf' } });
});

describe('change request helpers', () => {
  it('maps every status to a step, with cancelled outside the bar', () => {
    expect(getChangeRequestStep('submitted')).toBe(0);
    expect(getChangeRequestStep('more_info')).toBe(1);
    expect(getChangeRequestStep('rejected')).toBe(2);
    expect(getChangeRequestStep('completed')).toBe(4);
    expect(getChangeRequestStep('cancelled')).toBe(-1);
  });

  it('allows billing from Approved, In Progress and Completed only, and closes terminal states', () => {
    expect(['approved', 'in_progress', 'completed'].every(status => isBillable(status as never))).toBe(true);
    expect(isBillable('under_review')).toBe(false);
    expect(isTerminal('rejected')).toBe(true);
    expect(isTerminal('in_progress')).toBe(false);
  });

  it('leaves a blank estimate blank instead of showing 0', () => {
    const hours = (value: number) => `${value} h`;
    expect(formatEstimate(null, hours)).toBeNull();
    expect(formatEstimate({ hours: null, cost: null }, hours)).toBeNull();
    expect(formatEstimate({ hours: 0, cost: null }, hours)).toBe('0 h');
    expect(formatEstimate({ hours: 12, cost: 1500 }, hours, 'en')).toBe('12 h · 1,500');
  });
});

describe('ChangeRequestDetailModal', () => {
  it('moves status only through explicit actions, and asks for a response before rejecting', async () => {
    renderDetail();

    await openTab('Request & decision');
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(state.messageWarning).toHaveBeenCalledWith('Write a response for the client first.');
    expect(state.act).not.toHaveBeenCalled();

    await openTab('Conversation');
    fireEvent.change(screen.getByLabelText('Write the response the client will see…'), {
      target: { value: 'Out of scope for this phase.' },
    });
    await openTab('Request & decision');
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));

    await waitFor(() =>
      expect(state.act).toHaveBeenCalledWith({
        id: 'cr-1',
        body: { action: 'reject', response: 'Out of scope for this phase.' },
      })
    );
  });

  it('approves without a written response, leaving the server to send its default', async () => {
    renderDetail();

    await openTab('Request & decision');
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(state.act).toHaveBeenCalledWith({ id: 'cr-1', body: { action: 'approve' } }));
  });

  it('clears the estimate when both fields are emptied, so the client sees nothing', async () => {
    state.request = makeRequest({ estimate: { hours: 8, cost: 1200 } });
    renderDetail();

    await openTab('Request & decision');
    const hours = screen.getByLabelText('Extra time (hours)');
    const cost = screen.getByLabelText('Extra cost');
    fireEvent.change(hours, { target: { value: '' } });
    fireEvent.change(cost, { target: { value: '' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save estimate' }));

    await waitFor(() => expect(state.update).toHaveBeenCalledWith({ id: 'cr-1', body: { estimate: null } }));
  });

  it('offers Convert to work on an approved request and creates a task, Internal Only by default', async () => {
    state.request = makeRequest({ status: 'approved' });
    renderDetail();

    await openTab('Request & decision');
    await userEvent.click(screen.getByRole('button', { name: 'Convert to work…' }));
    expect(await screen.findByText('Convert to project work')).toBeInTheDocument();
    expect(screen.getByDisplayValue('CR-0048: Add a live chat widget')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Create work item' }));

    await waitFor(() =>
      expect(state.convert).toHaveBeenCalledWith({
        id: 'cr-1',
        body: { mode: 'create', title: 'CR-0048: Add a live chat widget', assignee_id: null, visibility: 'internal' },
      })
    );
  });

  it('shows billing shortcuts only for billable statuses', async () => {
    state.request = makeRequest({ status: 'under_review' });
    const { unmount } = renderDetail();
    await openTab('Linked work');
    expect(screen.queryByRole('button', { name: 'Create quote' })).not.toBeInTheDocument();
    unmount();

    state.request = makeRequest({ status: 'in_progress' });
    renderDetail();
    await openTab('Linked work');
    expect(screen.getByRole('button', { name: 'Create quote' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create invoice' })).toBeInTheDocument();
  });

  it('closes a rejected request: no cancel, no editing', async () => {
    state.request = makeRequest({ status: 'rejected' });
    renderDetail();
    await openTab('Request & decision');

    expect(screen.getByText('This request is closed. Its history is preserved.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel request' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save estimate' })).toBeDisabled();
  });

  it('lists attachments with their size and downloads one through a link', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    state.request = makeRequest({
      attachments: [
        { id: 'a-1', file_id: 'f-1', name: 'brief.pdf', size: 2 * 1024 * 1024 },
        { id: 'a-2', file_id: null, name: 'gone.png', size: 2048 },
      ],
    });
    renderDetail();

    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
    // A file removed from the project stays listed by name but cannot be downloaded.
    expect(screen.getByText('gone.png')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'gone.png' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'brief.pdf' }));

    await waitFor(() => expect(state.download).toHaveBeenCalledWith({ fileId: 'f-1' }));
    expect(open).toHaveBeenCalledWith('https://files.test/brief.pdf', '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });
});
