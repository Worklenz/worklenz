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
  approval: undefined as unknown,
  approvalError: false,
  options: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  projects: [] as unknown[],
  send: vi.fn(),
  cancel: vi.fn(),
  resubmit: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
}));

const trigger =
  (fn: (...args: unknown[]) => unknown) =>
  (...args: unknown[]) => {
    const promise = Promise.resolve().then(() => fn(...args));
    return Object.assign(promise, { unwrap: () => promise });
  };

vi.mock('@/api/client-portal/portal-workflow-api', () => ({
  useGetApprovalQuery: () => ({
    data: state.approval ? { body: state.approval } : undefined,
    isLoading: false,
    isError: state.approvalError,
    error: undefined,
    refetch: vi.fn(),
  }),
  useSendApprovalMutation: () => [trigger(state.send), { isLoading: false }],
  useCancelApprovalMutation: () => [trigger(state.cancel), { isLoading: false }],
  useResubmitApprovalMutation: () => [trigger(state.resubmit), { isLoading: false }],
  useCreateApprovalMutation: () => [trigger(state.create), { isLoading: false }],
  useUpdateApprovalMutation: () => [trigger(state.update), { isLoading: false }],
  useGetApprovalOptionsQuery: () => state.options,
}));

vi.mock('@/api/client-portal/portal-projects-api', () => ({
  useGetPortalProjectsQuery: () => ({
    data: { body: { items: state.projects, total: state.projects.length } },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/shared/antd-imports', async importOriginal => {
  const actual = await importOriginal<typeof import('@/shared/antd-imports')>();
  return {
    ...actual,
    message: { success: state.messageSuccess, error: state.messageError, warning: vi.fn(), info: vi.fn() },
  };
});

import type { Approval } from '@/types/client-portal/v2';
import { ApprovalDetailModal } from './ApprovalDetailModal';
import { CreateApprovalModal } from './CreateApprovalModal';
import { EditApprovalModal } from './EditApprovalModal';

const makeApproval = (overrides: Partial<Approval> = {}): Approval => ({
  id: 'ap-1',
  ref_no: 'AP-000123',
  organization_id: 'org-1',
  organization_name: 'Brandbase',
  project_id: 'p-1',
  project_name: 'Website redesign',
  title: 'Approve homepage wireframe',
  linked_item: {
    type: 'file',
    id: 'f-1',
    name: 'Homepage Wireframe.fig',
    file_version: 3,
    task_key: null,
    description: null,
  },
  approver_id: 'u-1',
  approver_name: 'Alex Rivera',
  approvers: [{ id: 'u-1', name: 'Alex Rivera' }],
  instructions: 'Check the layout',
  due_date: null,
  requested_at: '2026-06-01T10:00:00Z',
  status: 'awaiting',
  revision: 1,
  created_by: 'Taylor',
  decision: null,
  visible_to_client: true,
  is_overdue: false,
  newer_file_version: null,
  history: [],
  earlier_revisions: [],
  discussion: null,
  ...overrides,
});

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={['/approvals/ap-1']}>
      <Routes>
        <Route path="/approvals/:approvalId" element={<ApprovalDetailModal />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  state.approval = makeApproval();
  state.approvalError = false;
  state.send.mockResolvedValue({ body: {} });
  state.cancel.mockResolvedValue({ body: {} });
  state.resubmit.mockResolvedValue({ body: {} });
  state.create.mockResolvedValue({ body: { ref_no: 'AP-000124' } });
  state.update.mockResolvedValue({ body: {} });
});

describe('ApprovalDetailModal', () => {
  it('offers only the actions that fit the status', () => {
    state.approval = makeApproval({ status: 'draft', visible_to_client: false });
    const { unmount } = renderDetail();
    expect(screen.getByRole('button', { name: 'Send to client' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel request' })).not.toBeInTheDocument();
    unmount();

    state.approval = makeApproval({ status: 'awaiting' });
    const awaiting = renderDetail();
    expect(screen.getByRole('button', { name: 'Cancel request' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send to client' })).not.toBeInTheDocument();
    awaiting.unmount();

    state.approval = makeApproval({ status: 'approved' });
    renderDetail();
    expect(screen.getByRole('button', { name: 'Request re-approval (new revision)' })).toBeInTheDocument();
  });

  it('sends a draft to the client', async () => {
    state.approval = makeApproval({ status: 'draft', visible_to_client: false });
    renderDetail();

    await userEvent.click(screen.getByRole('button', { name: 'Send to client' }));

    await waitFor(() => expect(state.send).toHaveBeenCalledWith('ap-1'));
    await waitFor(() =>
      expect(state.messageSuccess).toHaveBeenCalledWith('AP-000123 sent. Alex Rivera is notified.')
    );
  });

  it('asks before cancelling and explains what the approver loses', async () => {
    renderDetail();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
    expect(await screen.findByText('Cancel this approval request?')).toBeInTheDocument();
    expect(
      screen.getByText('AP-000123 is withdrawn and Alex Rivera no longer sees it as pending. The history is kept.')
    ).toBeInTheDocument();
    expect(state.cancel).not.toHaveBeenCalled();

    const confirm = screen.getAllByRole('button', { name: 'Cancel request' }).pop() as HTMLElement;
    await userEvent.click(confirm);
    await waitFor(() => expect(state.cancel).toHaveBeenCalledWith('ap-1'));
  });

  it('resubmits a file approval straight away as the next revision', async () => {
    state.approval = makeApproval({ status: 'changes_requested' });
    renderDetail();

    await userEvent.click(screen.getByRole('button', { name: 'Resubmit as new revision' }));

    await waitFor(() => expect(state.resubmit).toHaveBeenCalledWith({ approvalId: 'ap-1', body: undefined }));
  });

  it('asks for a description before resubmitting a free-form item', async () => {
    state.approval = makeApproval({
      status: 'changes_requested',
      linked_item: { type: 'freeform', id: null, name: 'Rollout approach', file_version: null, task_key: null, description: 'Phase one first' },
    });
    renderDetail();

    await userEvent.click(screen.getByRole('button', { name: 'Resubmit as new revision' }));
    expect(state.resubmit).not.toHaveBeenCalled();

    const description = await screen.findByDisplayValue('Phase one first');
    fireEvent.change(description, { target: { value: 'Phase one, then two' } });
    await userEvent.click(screen.getByRole('button', { name: 'Resubmit for approval' }));

    await waitFor(() =>
      expect(state.resubmit).toHaveBeenCalledWith({ approvalId: 'ap-1', body: { description: 'Phase one, then two' } })
    );
  });

  it('tells staff when a file has moved on since it was approved', () => {
    state.approval = makeApproval({ status: 'approved', newer_file_version: 4 });
    renderDetail();

    expect(
      screen.getByText(/This approval covers v3\. The file has since moved to v4/)
    ).toBeInTheDocument();
  });
});

describe('CreateApprovalModal', () => {
  const renderCreate = () =>
    render(
      <MemoryRouter initialEntries={['/approvals/new']}>
        <Routes>
          <Route path="/approvals/new" element={<CreateApprovalModal />} />
        </Routes>
      </MemoryRouter>
    );

  beforeEach(() => {
    state.projects = [
      { id: 'p-1', name: 'Website redesign', organization_id: 'org-1', organization_name: 'Brandbase', portal_enabled: true },
    ];
    state.options = {
      data: {
        body: {
          linkable: {
            files: [{ id: 'f-1', name: 'Homepage.fig', current_version: 3 }],
            milestones: [],
            tasks: [],
            internal_counts: { files: 2, milestones: 0, tasks: 1 },
          },
          approvers: [],
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
  });

  it('keeps Save draft and Send disabled until the form is complete', () => {
    renderCreate();

    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send for approval' })).toBeDisabled();
  });

  it('says the client has no active users when there is nobody to approve', async () => {
    renderCreate();

    await userEvent.click(screen.getByRole('combobox', { name: 'Project' }));
    await userEvent.click(await screen.findByText('Website redesign \u00b7 Brandbase'));

    expect(
      await screen.findByText('This client has no active users yet. Invite one under Clients \u2192 Users.')
    ).toBeInTheDocument();
  });

  it('lets staff name several client users, of any role, as approvers', async () => {
    state.create.mockResolvedValue({ body: { ref_no: 'AP-000124' } });
    (state.options as { data: { body: { approvers: unknown[] } } }).data.body.approvers = [
      { id: 'u-1', name: 'Alex Rivera', email: 'alex@brandbase.com', role: 'admin' },
      { id: 'u-2', name: 'Sam Lee', email: 'sam@brandbase.com', role: 'member' },
    ];
    renderCreate();

    await userEvent.click(screen.getByRole('combobox', { name: 'Project' }));
    await userEvent.click(await screen.findByText('Website redesign \u00b7 Brandbase'));
    await userEvent.type(screen.getByLabelText('What is being approved'), 'Approve launch plan');
    await userEvent.click(screen.getByText('Free-form item'));
    await userEvent.type(screen.getByLabelText('Item name, e.g. Launch rollout approach'), 'Launch plan');

    const approvers = screen.getByRole('combobox', { name: 'Approvers' });
    await userEvent.click(approvers);
    await userEvent.click(await screen.findByText('Alex Rivera \u00b7 alex@brandbase.com \u00b7 Client Admin'));
    await userEvent.click(approvers);
    await userEvent.click(await screen.findByText('Sam Lee \u00b7 sam@brandbase.com \u00b7 Client Member'));
    await userEvent.click(screen.getByRole('button', { name: 'Send for approval' }));

    await waitFor(() =>
      expect(state.create).toHaveBeenCalledWith(expect.objectContaining({ approver_ids: ['u-1', 'u-2'], send: true }))
    );
  });
  it('renders Ant Design DatePicker with accessible placeholder and handles date input', async () => {
    state.create.mockResolvedValue({ body: { ref_no: 'AP-000125' } });
    (state.options as { data: { body: { approvers: unknown[] } } }).data.body.approvers = [
      { id: 'u-1', name: 'Alex Rivera', email: 'alex@brandbase.com', role: 'admin' },
    ];
    renderCreate();

    const datePicker = screen.getByLabelText('Due date (optional)');
    expect(datePicker).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Select due date')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('combobox', { name: 'Project' }));
    await userEvent.click(await screen.findByText('Website redesign · Brandbase'));
    await userEvent.type(screen.getByLabelText('What is being approved'), 'Approve with due date');
    await userEvent.click(screen.getByText('Free-form item'));
    await userEvent.type(screen.getByLabelText('Item name, e.g. Launch rollout approach'), 'Item');

    const approvers = screen.getByRole('combobox', { name: 'Approvers' });
    await userEvent.click(approvers);
    await userEvent.click(await screen.findByText('Alex Rivera · alex@brandbase.com · Client Admin'));

    fireEvent.change(datePicker, { target: { value: '2026-11-15' } });
    fireEvent.keyDown(datePicker, { key: 'Enter', code: 'Enter' });

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() =>
      expect(state.create).toHaveBeenCalledWith(
        expect.objectContaining({ due_date: '2026-11-15', send: false })
      )
    );
  });
});

describe('EditApprovalModal', () => {
  it('renders DatePicker initialized with existing due date and allows editing', async () => {
    const approval = makeApproval({
      due_date: '2026-12-01',
      linked_item: { type: 'freeform', name: 'Existing item', description: 'Desc', id: null, file_version: null, task_key: null },
    });
    (state.options as unknown as Record<string, unknown>) = {
      data: {
        body: {
          linkable: { files: [], milestones: [], tasks: [], internal_counts: { files: 0, milestones: 0, tasks: 0 } },
          approvers: [{ id: 'u-1', name: 'Alex Rivera', email: 'alex@brandbase.com', role: 'admin' }],
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };

    render(<EditApprovalModal approval={approval} onClose={vi.fn()} />);

    const datePicker = screen.getByLabelText('Due date (optional)');
    expect(datePicker).toBeInTheDocument();
    expect(datePicker).toHaveValue('2026-12-01');

    fireEvent.change(datePicker, { target: { value: '2026-12-15' } });
    fireEvent.keyDown(datePicker, { key: 'Enter', code: 'Enter' });

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(state.update).toHaveBeenCalledWith(
        expect.objectContaining({
          approvalId: 'ap-1',
          body: expect.objectContaining({ due_date: '2026-12-15' }),
        })
      )
    );
  });
});
