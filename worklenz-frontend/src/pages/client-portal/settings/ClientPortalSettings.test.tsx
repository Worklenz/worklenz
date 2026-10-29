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
  getLegacy: vi.fn(),
  updateLegacy: vi.fn(),
  saveV2: vi.fn(),
  v2Settings: undefined as unknown,
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
  messageInfo: vi.fn(),
}));

const trigger =
  (fn: (...args: unknown[]) => unknown) =>
  (...args: unknown[]) => {
    const promise = Promise.resolve().then(() => fn(...args));
    return Object.assign(promise, { unwrap: () => promise });
  };

vi.mock('@/api/settings/profile/profile-settings.api.service', () => ({
  profileSettingsApiService: {
    getClientPortalSettings: () => state.getLegacy(),
    updateClientPortalSettings: (body: unknown) => state.updateLegacy(body),
    uploadClientPortalLogo: vi.fn(),
  },
}));

vi.mock('@/api/client-portal/portal-access-api', () => ({
  useGetPortalSettingsQuery: () => ({
    data: state.v2Settings ? { body: { settings: state.v2Settings, shared: { tasks: { shared: 1, total: 4 }, files: { shared: 0, total: 0 }, milestones: { shared: 0, total: 0 } } } } : undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useSavePortalSettingsMutation: () => [trigger(state.saveV2), { isLoading: false }],
}));

vi.mock('@/api/client-portal/portal-counts-api', () => ({
  useGetClientRolesQuery: () => ({ data: { body: [] }, isLoading: false, isError: true, isFetching: false, refetch: vi.fn() }),
}));

vi.mock('@/hooks/useMixpanelTracking', () => ({
  useMixpanelTracking: () => ({ trackMixpanelEvent: vi.fn() }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => ({
    getCurrentSession: () => ({ subscription_type: 'BUSINESS' }),
  }),
}));

vi.mock('@/hooks/useIsAdminSurfaceReadOnly', () => ({
  useIsAdminSurfaceReadOnly: () => false,
}));

// The three legacy sections are stand-ins: this spec is about how the page saves, not about their fields.
vi.mock('./sections/CompanyDetailsSection', () => ({
  CompanyDetailsSection: ({ onChange }: { onChange: (patch: Record<string, unknown>) => void }) => (
    <div>
      <button type="button" onClick={() => onChange({ company_name: 'Ceydigital' })}>
        rename company
      </button>
      <button type="button" onClick={() => onChange({ contact_phone: '+94 11 234 5678' })}>
        valid phone
      </button>
      <button type="button" onClick={() => onChange({ contact_phone: '+94 11 234 5678 99999' })}>
        invalid phone
      </button>
    </div>
  ),
}));
vi.mock('./sections/BrandingSection', () => ({ BrandingSection: () => <div>branding</div> }));
vi.mock('./sections/InvoiceTemplateSection', () => ({ InvoiceTemplateSection: () => <div>template</div> }));

vi.mock('@/shared/antd-imports', async importOriginal => {
  const actual = await importOriginal<typeof import('@/shared/antd-imports')>();
  return {
    ...actual,
    message: {
      success: state.messageSuccess,
      error: state.messageError,
      info: state.messageInfo,
      warning: vi.fn(),
    },
  };
});

import ClientPortalSettings from './ClientPortalSettings';

const v2Defaults = {
  show_invoices: false,
  allow_client_uploads_default: true,
  admins_can_invite_users: false,
  admins_can_remove_users: false,
  client_email_events: {
    approval_request: true,
    comment_or_reply: true,
    file_shared: false,
    milestone_change: false,
    project_update: false,
    change_request_update: true,
    access_changes: true,
  },
  team_email_events: { client_comment: true, approval_decision: true, change_request: true, client_file_upload: false },
};

const legacyBody = {
  company_name: 'Old name',
  visible_invoices: true,
  poc_can_add_users: true,
  poc_can_remove_users: true,
  visible_project_plan: true,
  invoice_template_style: 'classic',
};

beforeEach(() => {
  vi.clearAllMocks();
  state.v2Settings = v2Defaults;
  state.getLegacy.mockResolvedValue({ done: true, body: legacyBody });
  state.updateLegacy.mockResolvedValue({ done: true, body: {} });
  state.saveV2.mockResolvedValue({ body: {} });
});

// The rail icons add their own accessible name ("bank Company Details"), so match the label as a substring.
const navButton = (name: string) => screen.getByRole('button', { name: new RegExp(name) });

const openSection = async (name: string) => {
  await screen.findByRole('button', { name: /Company Details/ });
  await userEvent.click(navButton(name));
};

describe('ClientPortalSettings', () => {
  it('lists the six v2 sections plus the invoice template, in order', async () => {
    render(<ClientPortalSettings />);
    await screen.findByRole('button', { name: /Company Details/ });

    const labels = screen
      .getByRole('navigation')
      .querySelectorAll('button');
    expect(Array.from(labels).map(button => button.textContent?.trim())).toEqual([
      'Company Details',
      'Branding',
      'Invoice Template',
      'Sharing & Visibility',
      'Client Roles',
      'Notifications',
    ]);
  });

  it('saves only the v2 settings when only a v2 switch changed, and notes the audit event', async () => {
    render(<ClientPortalSettings />);
    await openSection('Sharing & Visibility');

    expect(screen.queryByRole('button', { name: /Save Changes/ })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('switch', { name: 'Show Invoices in the client portal' }));
    await userEvent.click(screen.getByRole('button', { name: /Save Changes/ }));

    await waitFor(() => expect(state.saveV2).toHaveBeenCalledWith({ ...v2Defaults, show_invoices: true }));
    expect(state.updateLegacy).not.toHaveBeenCalled();
    await waitFor(() => expect(state.messageInfo).toHaveBeenCalledWith('Permission change recorded in the audit log.'));
  });

  it('never sends the v2-owned fields through the older company and branding save', async () => {
    render(<ClientPortalSettings />);
    await screen.findByRole('button', { name: /Company Details/ });

    await userEvent.click(await screen.findByRole('button', { name: 'rename company' }));
    await userEvent.click(screen.getByRole('button', { name: /Save Changes/ }));

    await waitFor(() => expect(state.updateLegacy).toHaveBeenCalledTimes(1));
    const payload = state.updateLegacy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.company_name).toBe('Ceydigital');
    expect(payload).not.toHaveProperty('visible_invoices');
    expect(payload).not.toHaveProperty('poc_can_add_users');
    expect(payload).not.toHaveProperty('poc_can_remove_users');
    expect(state.saveV2).not.toHaveBeenCalled();
    await waitFor(() => expect(state.messageSuccess).toHaveBeenCalledTimes(1));
    expect(state.messageSuccess).toHaveBeenCalledWith('Settings saved successfully');
  });

  it('has no sign-in configuration: clients always sign in with an emailed code', async () => {
    render(<ClientPortalSettings />);
    await openSection('Client Roles');

    expect(await screen.findByText('How clients sign in')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Authentication/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /sign-in/i })).not.toBeInTheDocument();
    expect(screen.getByText(/There are no passwords/)).toBeInTheDocument();
  });

  it('discards unsaved changes on Cancel', async () => {
    render(<ClientPortalSettings />);
    await openSection('Sharing & Visibility');

    await userEvent.click(await screen.findByRole('switch', { name: 'Show Invoices in the client portal' }));
    expect(screen.getByRole('button', { name: /Save Changes/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(screen.queryByRole('button', { name: /Save Changes/ })).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Show Invoices in the client portal' })).not.toBeChecked();
  });

  it('keeps Save Changes enabled on invalid phone format, but blocks saving and displays error on click', async () => {
    render(<ClientPortalSettings />);
    await screen.findByRole('button', { name: /Company Details/ });

    await userEvent.click(await screen.findByRole('button', { name: 'invalid phone' }));
    const saveButton = screen.getByRole('button', { name: /Save Changes/ });
    expect(saveButton).toBeInTheDocument();
    expect(saveButton).not.toBeDisabled();

    await userEvent.click(saveButton);

    expect(state.updateLegacy).not.toHaveBeenCalled();
    expect(state.messageSuccess).not.toHaveBeenCalled();
    expect(state.messageError).toHaveBeenCalledWith(
      'Invalid phone number format. Use international format (e.g., +1-234-567-8900)'
    );
  });

  it('allows saving when a valid phone number is entered', async () => {
    render(<ClientPortalSettings />);
    await screen.findByRole('button', { name: /Company Details/ });

    await userEvent.click(await screen.findByRole('button', { name: 'valid phone' }));
    const saveButton = screen.getByRole('button', { name: /Save Changes/ });
    await userEvent.click(saveButton);

    await waitFor(() => expect(state.updateLegacy).toHaveBeenCalledTimes(1));
    const payload = state.updateLegacy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.contact_phone).toBe('+94 11 234 5678');
    expect(state.messageSuccess).toHaveBeenCalledWith('Settings saved successfully');
  });
});
