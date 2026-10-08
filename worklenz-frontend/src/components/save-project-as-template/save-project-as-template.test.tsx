import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SaveProjectAsTemplate from './save-project-as-template';

const mocks = vi.hoisted(() => ({
  createCustomTemplate: vi.fn(),
  dispatch: vi.fn(),
  alertService: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  legacyNotification: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    open: vi.fn(),
    destroy: vi.fn(),
  },
  legacyMessageSuccess: vi.fn(),
  t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mocks.t }),
}));
vi.mock('@/shared/antd-imports', async importOriginal => {
  const actual = await importOriginal<typeof import('@/shared/antd-imports')>();
  return {
    ...actual,
    notification: {
      ...actual.notification,
      ...mocks.legacyNotification,
      useNotification: () => [mocks.legacyNotification, null],
    },
    message: { ...actual.message, success: mocks.legacyMessageSuccess },
  };
});
vi.mock('@/services/alerts/alertService', () => ({ default: mocks.alertService }));
vi.mock('@/api/project-templates/project-templates.api.service', () => ({
  projectTemplatesApiService: {
    createCustomTemplate: (...args: unknown[]) => mocks.createCustomTemplate(...args),
  },
}));
vi.mock('@/features/projects/projectsSlice', () => ({
  closeSaveAsTemplateDrawer: () => ({ type: 'projects/closeSaveAsTemplateDrawer' }),
}));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      projectsReducer: { isSaveAsTemplateDrawerOpen: true },
      projectReducer: { projectId: 'project-1', project: { name: 'Alpha' } },
    }),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => ({ getCurrentSession: () => ({ id: 'u-me' }) }),
}));
vi.mock('@/hooks/useProjectPermissions', () => ({
  default: () => ({ permissions: { finance: false } }),
}));
vi.mock('@/utils/subscription-utils', () => ({ hasBusinessFeatureAccess: () => false }));

const SUCCESS_TITLE = 'Template Created';
const SUCCESS_DESCRIPTION =
  'Your project template has been successfully created and is ready to use.';
const CLOSE_ACTION = { type: 'projects/closeSaveAsTemplateDrawer' };

const submitTemplate = async (name = 'Alpha template') => {
  const user = userEvent.setup();
  render(<SaveProjectAsTemplate />);

  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByLabelText('Template Name'));
  await user.paste(name);
  await user.click(within(dialog).getByRole('button', { name: /Save/ }));
  await waitFor(() => expect(mocks.createCustomTemplate).toHaveBeenCalledTimes(1));
  return dialog;
};

const expectNoLegacyNotification = () => {
  Object.values(mocks.legacyNotification).forEach(fn => expect(fn).not.toHaveBeenCalled());
  expect(mocks.legacyMessageSuccess).not.toHaveBeenCalled();
};

describe('SaveProjectAsTemplate notifications', { timeout: 20000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows exactly one alertService success alert and closes after a successful create', async () => {
    mocks.createCustomTemplate.mockResolvedValue({ done: true, body: { id: 'tpl-1' } });

    await submitTemplate();

    expect(mocks.createCustomTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 'project-1', templateName: 'Alpha template' })
    );
    await waitFor(() => expect(mocks.alertService.success).toHaveBeenCalledTimes(1));
    expect(mocks.alertService.success).toHaveBeenCalledWith(SUCCESS_TITLE, SUCCESS_DESCRIPTION);
    expect(mocks.alertService.error).not.toHaveBeenCalled();
    expectNoLegacyNotification();
    await waitFor(() => expect(mocks.dispatch).toHaveBeenCalledWith(CLOSE_ACTION), {
      timeout: 2000,
    });
  });

  it('keeps the drawer open with the in-drawer error and no success alert on { done: false }', async () => {
    mocks.createCustomTemplate.mockResolvedValue({
      done: false,
      message: 'Template name already exists',
    });

    const dialog = await submitTemplate();

    expect(await within(dialog).findByText('Template name already exists')).toBeInTheDocument();
    expect(mocks.alertService.success).not.toHaveBeenCalled();
    expectNoLegacyNotification();
    expect(mocks.dispatch).not.toHaveBeenCalledWith(CLOSE_ACTION);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('falls back to the translated error text when { done: false } has no message', async () => {
    mocks.createCustomTemplate.mockResolvedValue({ done: false });

    const dialog = await submitTemplate();

    expect(await within(dialog).findByText('Template Creation Failed')).toBeInTheDocument();
    expect(mocks.alertService.success).not.toHaveBeenCalled();
    expectNoLegacyNotification();
  });

  it('keeps the drawer open with the server reason and no success alert when the request rejects', async () => {
    mocks.createCustomTemplate.mockRejectedValue({
      response: { data: { message: 'You do not have permission to create templates.' } },
    });

    const dialog = await submitTemplate();

    expect(
      await within(dialog).findByText('You do not have permission to create templates.')
    ).toBeInTheDocument();
    expect(mocks.alertService.success).not.toHaveBeenCalled();
    expectNoLegacyNotification();
    expect(mocks.dispatch).not.toHaveBeenCalledWith(CLOSE_ACTION);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('falls back to the translated unexpected-error text when a rejection has no server message', async () => {
    mocks.createCustomTemplate.mockRejectedValue(new Error('Network Error'));

    const dialog = await submitTemplate();

    expect(await within(dialog).findByText('An unexpected error occurred')).toBeInTheDocument();
    expect(mocks.alertService.success).not.toHaveBeenCalled();
    expectNoLegacyNotification();
  });
});
