import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
  deactivate: vi.fn(),
  reactivate: vi.fn(),
  deleteOrganization: vi.fn(),
  restore: vi.fn(),
  refetchPreview: vi.fn(),
  previewArgs: vi.fn(),
  preview: {
    data: undefined as unknown,
    isError: false,
    isFetching: false,
  },
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
}));

/** An RTK Query mutation trigger whose promise has `.unwrap()`. */
const trigger =
  (fn: (...args: unknown[]) => unknown) =>
  (...args: unknown[]) => {
    const promise = Promise.resolve().then(() => fn(...args));
    return Object.assign(promise, { unwrap: () => promise });
  };

vi.mock('@/api/client-portal/portal-access-api', () => ({
  useDeactivatePortalOrganizationMutation: () => [trigger(state.deactivate), { isLoading: false }],
  useReactivatePortalOrganizationMutation: () => [trigger(state.reactivate), { isLoading: false }],
  useDeletePortalOrganizationMutation: () => [trigger(state.deleteOrganization), { isLoading: false }],
  useRestorePortalOrganizationMutation: () => [trigger(state.restore), { isLoading: false }],
  useGetOrganizationDeletePreviewQuery: (id: string, options?: { skip?: boolean }) => {
    state.previewArgs(id, options);
    return { ...state.preview, data: options?.skip ? undefined : state.preview.data, refetch: state.refetchPreview };
  },
}));

vi.mock('@/shared/antd-imports', async importOriginal => {
  const actual = await importOriginal<typeof import('@/shared/antd-imports')>();
  return {
    ...actual,
    message: { success: state.messageSuccess, error: state.messageError, warning: vi.fn(), info: vi.fn() },
  };
});

import { useClientOrganizationActions, type ClientOrganizationActionOptions } from './useClientOrganizationActions';

const ORG = { id: 'org-1', name: 'Brandbase' };

const Harness = ({ options }: { options?: ClientOrganizationActionOptions }) => {
  const { actions, modals } = useClientOrganizationActions(options);
  return (
    <>
      <button onClick={() => actions.onDeactivate(ORG)}>open deactivate</button>
      <button onClick={() => actions.onReactivate(ORG)}>open reactivate</button>
      <button onClick={() => actions.onDelete(ORG)}>open delete</button>
      <button onClick={() => actions.onRestore(ORG)}>open restore</button>
      {modals}
    </>
  );
};

const previewOf = (overrides: Record<string, unknown> = {}) => ({
  body: {
    organization_id: 'org-1',
    name: 'Brandbase',
    status: 'active',
    active_users: 2,
    invited_users: 1,
    total_users: 3,
    portal_projects: 2,
    open_invoices: [],
    pending_approvals: [],
    open_change_requests: [],
    retention_days: 30,
    ...overrides,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  state.preview = { data: previewOf(), isError: false, isFetching: false };
  state.deactivate.mockResolvedValue({ body: {} });
  state.reactivate.mockResolvedValue({ body: {} });
  state.deleteOrganization.mockResolvedValue({
    body: { organization_id: 'org-1', deleted_at: '2026-10-01T00:00:00.000Z', purge_on: '2026-10-31T00:00:00.000Z' },
  });
  state.restore.mockResolvedValue({ body: {} });
});

describe('deactivating and reactivating a client', () => {
  it('names the effect and waits for the confirmation before calling the API', async () => {
    const onDeactivated = vi.fn();
    render(<Harness options={{ onDeactivated }} />);

    await userEvent.click(screen.getByText('open deactivate'));
    expect(await screen.findByText('Deactivate Brandbase?')).toBeInTheDocument();
    expect(screen.getByText(/Everyone at Brandbase loses portal access right away/)).toBeInTheDocument();
    expect(state.deactivate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Deactivate client' }));
    await waitFor(() => expect(state.deactivate).toHaveBeenCalledWith('org-1'));
    await waitFor(() =>
      expect(state.messageSuccess).toHaveBeenCalledWith('Brandbase was deactivated. Its users can no longer sign in.')
    );
    expect(onDeactivated).toHaveBeenCalledWith(ORG);
  });

  it('does nothing when the dialog is cancelled', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText('open deactivate'));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(state.deactivate).not.toHaveBeenCalled();
  });

  it('shows the server’s reason when a deactivation fails', async () => {
    state.deactivate.mockRejectedValueOnce({ data: { message: 'This client has been deleted.' } });
    render(<Harness />);
    await userEvent.click(screen.getByText('open deactivate'));
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate client' }));
    await waitFor(() => expect(state.messageError).toHaveBeenCalledWith('This client has been deleted.'));
  });

  it('confirms a reactivation too', async () => {
    const onReactivated = vi.fn();
    render(<Harness options={{ onReactivated }} />);
    await userEvent.click(screen.getByText('open reactivate'));
    expect(await screen.findByText('Reactivate Brandbase?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reactivate client' }));
    await waitFor(() => expect(state.reactivate).toHaveBeenCalledWith('org-1'));
    expect(onReactivated).toHaveBeenCalledWith(ORG);
  });
});

describe('deleting a client', () => {
  it('only asks the server what it affects once the dialog is open', async () => {
    render(<Harness />);
    expect(state.previewArgs).toHaveBeenLastCalledWith('', { skip: true });

    await userEvent.click(screen.getByText('open delete'));
    await screen.findByText('Delete Brandbase?');
    expect(state.previewArgs).toHaveBeenLastCalledWith('org-1', { skip: false });
  });

  it('says who loses access and that everything is kept for 30 days, then deletes', async () => {
    const onDeleted = vi.fn();
    render(<Harness options={{ onDeleted }} />);

    await userEvent.click(screen.getByText('open delete'));
    expect(await screen.findByText('Users who lose access right away: 3')).toBeInTheDocument();
    expect(screen.getByText(/kept for 30 days/)).toBeInTheDocument();
    expect(screen.getByText(/invoices are kept as records/)).toBeInTheDocument();
    expect(state.deleteOrganization).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Delete client' }));
    await waitFor(() =>
      expect(state.deleteOrganization).toHaveBeenCalledWith({
        organizationId: 'org-1',
        confirmPendingApprovals: false,
        confirmOpenChangeRequests: false,
      })
    );
    await waitFor(() =>
      expect(state.messageSuccess).toHaveBeenCalledWith(expect.stringMatching(/^Brandbase was deleted\. You can restore it until .+\.$/))
    );
    expect(onDeleted).toHaveBeenCalledWith(ORG);
  });

  it('is blocked, with the invoice numbers, while there is an unpaid invoice', async () => {
    state.preview = {
      data: previewOf({ open_invoices: [{ invoice_no: 'INV-1001', currency: 'USD', outstanding: 250 }] }),
      isError: false,
      isFetching: false,
    };
    render(<Harness />);

    await userEvent.click(screen.getByText('open delete'));
    expect(await screen.findByText('Unpaid invoices')).toBeInTheDocument();
    expect(screen.getByText(/INV-1001\. Settle or cancel these invoices/)).toBeInTheDocument();

    const confirm = screen.getByRole('button', { name: 'Delete client' });
    expect(confirm).toBeDisabled();
    await userEvent.click(confirm);
    expect(state.deleteOrganization).not.toHaveBeenCalled();
  });

  it('keeps the button off until pending approvals and open change requests are acknowledged', async () => {
    state.preview = {
      data: previewOf({
        pending_approvals: [{ ref_no: 'AP-000007', title: 'Logo' }],
        open_change_requests: [{ title: 'Add pricing page' }],
      }),
      isError: false,
      isFetching: false,
    };
    render(<Harness />);

    await userEvent.click(screen.getByText('open delete'));
    expect(await screen.findByText(/Approvals still waiting for a decision: AP-000007/)).toBeInTheDocument();
    expect(screen.getByText(/Open change requests: Add pricing page/)).toBeInTheDocument();

    const confirm = screen.getByRole('button', { name: 'Delete client' });
    expect(confirm).toBeDisabled();

    await userEvent.click(screen.getByLabelText('I understand these approvals can no longer be decided.'));
    expect(confirm).toBeDisabled();
    await userEvent.click(screen.getByLabelText('I understand these change requests can no longer be worked on.'));
    expect(confirm).toBeEnabled();

    await userEvent.click(confirm);
    await waitFor(() =>
      expect(state.deleteOrganization).toHaveBeenCalledWith({
        organizationId: 'org-1',
        confirmPendingApprovals: true,
        confirmOpenChangeRequests: true,
      })
    );
  });

  it('checks again and says why when what it showed was out of date', async () => {
    state.deleteOrganization.mockRejectedValueOnce({
      data: { message: 'Brandbase has an unpaid invoice (INV-2).', body: { code: 'OPEN_INVOICES' } },
    });
    const onDeleted = vi.fn();
    render(<Harness options={{ onDeleted }} />);

    await userEvent.click(screen.getByText('open delete'));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete client' }));

    await waitFor(() => expect(state.messageError).toHaveBeenCalledWith('Brandbase has an unpaid invoice (INV-2).'));
    expect(state.refetchPreview).toHaveBeenCalled();
    // Still open, nothing was deleted.
    expect(screen.getByText('Delete Brandbase?')).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('offers a retry when it cannot check what deleting affects, and never deletes blind', async () => {
    state.preview = { data: undefined, isError: true, isFetching: false };
    render(<Harness />);

    await userEvent.click(screen.getByText('open delete'));
    expect(await screen.findByText('We could not check what deleting this client affects.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete client' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(state.refetchPreview).toHaveBeenCalled();
  });
});

describe('restoring a deleted client', () => {
  it('asks, then restores', async () => {
    const onRestored = vi.fn();
    render(<Harness options={{ onRestored }} />);

    await userEvent.click(screen.getByText('open restore'));
    expect(await screen.findByText('Restore Brandbase?')).toBeInTheDocument();
    expect(state.restore).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Restore client' }));
    await waitFor(() => expect(state.restore).toHaveBeenCalledWith({ organizationId: 'org-1', newName: undefined }));
    expect(onRestored).toHaveBeenCalledWith(ORG);
  });

  it('asks for a new name when another client took the old one, then restores under it', async () => {
    state.restore.mockRejectedValueOnce({
      data: { message: 'Another client is already named "Brandbase".', body: { code: 'NAME_TAKEN' } },
    });
    render(<Harness />);

    await userEvent.click(screen.getByText('open restore'));
    await userEvent.click(await screen.findByRole('button', { name: 'Restore client' }));

    expect(await screen.findByText(/Another client is already named “Brandbase”/)).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Restore client' });
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText('New client name'), '  Brandbase Group ');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);

    await waitFor(() =>
      expect(state.restore).toHaveBeenLastCalledWith({ organizationId: 'org-1', newName: 'Brandbase Group' })
    );
  });

  it('says why when the window has ended', async () => {
    state.restore.mockRejectedValueOnce({
      data: { message: 'The 30-day window to restore this client has ended.', body: { code: 'RETENTION_EXPIRED' } },
    });
    render(<Harness />);
    await userEvent.click(screen.getByText('open restore'));
    await userEvent.click(await screen.findByRole('button', { name: 'Restore client' }));
    await waitFor(() =>
      expect(state.messageError).toHaveBeenCalledWith('The 30-day window to restore this client has ended.')
    );
  });
});
