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
  startThread: vi.fn(),
  projectsQuery: vi.fn(),
  projects: [] as Array<{ id: string; name: string }>,
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
  presign: vi.fn(),
  confirm: vi.fn(),
  upload: vi.fn(),
}));

const trigger =
  (fn: (...args: unknown[]) => unknown) =>
  (...args: unknown[]) => {
    const promise = Promise.resolve().then(() => fn(...args));
    return Object.assign(promise, { unwrap: () => promise });
  };

vi.mock('@/api/client-portal/portal-projects-api', () => ({
  useGetPortalProjectsQuery: (params: unknown) => {
    state.projectsQuery(params);
    return { data: { body: { items: state.projects } }, isLoading: false };
  },
  usePresignPortalFileMutation: () => [trigger(state.presign)],
  useConfirmPortalFileMutation: () => [trigger(state.confirm)],
}));

vi.mock('@/api/projects/project-files.api.service', () => ({ default: { uploadDirect: state.upload } }));

vi.mock('@/api/client-portal/portal-workflow-api', () => ({
  useGetThreadOptionsQuery: (projectId: string, options?: { skip?: boolean }) => ({
    data: options?.skip
      ? undefined
      : {
          body: {
            context: { tasks: [], files: [], approvals: [] },
            mentions: [
              { id: 'u-1', name: 'Alex Rivera' },
              { id: 'u-2', name: 'Jamie Wu' },
            ],
          },
        },
    isLoading: false,
    projectId,
  }),
  useStartThreadMutation: () => [trigger(state.startThread), { isLoading: false }],
}));

vi.mock('@/shared/antd-imports', async importOriginal => {
  const actual = await importOriginal<typeof import('@/shared/antd-imports')>();
  return {
    ...actual,
    message: { success: state.messageSuccess, error: state.messageError, warning: vi.fn(), info: vi.fn() },
  };
});

// ProseMirror needs a real layout engine; a textarea plays the editor here.
vi.mock('./RichMessageEditor', async () => {
  const { RichMessageEditorStub } = await import('./richMessageEditorStub');
  return { RichMessageEditor: RichMessageEditorStub };
});

import { NewDiscussionModal } from './NewDiscussionModal';

const renderModal = (props: Partial<React.ComponentProps<typeof NewDiscussionModal>> = {}) => {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  render(<NewDiscussionModal projectId="p-1" onClose={onClose} onCreated={onCreated} {...props} />);
  return { onClose, onCreated };
};

const writeFirstMessage = async (text = 'Kick-off notes') => {
  await userEvent.type(screen.getByRole('textbox', { name: 'First message (visible to the client)' }), text);
};

const start = () => userEvent.click(screen.getByRole('button', { name: 'Start discussion' }));

beforeEach(() => {
  vi.clearAllMocks();
  state.projects = [];
  state.startThread.mockResolvedValue({ body: { id: 'th-1' } });
  state.presign.mockResolvedValue({ body: { file_id: 'f-1', upload_url: 'https://upload.test/f-1', expires_in: 900 } });
  state.confirm.mockResolvedValue({ body: { id: 'f-1' } });
  state.upload.mockResolvedValue(undefined);
});

describe('NewDiscussionModal: who is notified', () => {
  it('notifies everyone on the project by default and says so', async () => {
    const { onCreated } = renderModal();
    expect(screen.getByText('Everyone on this project')).toBeInTheDocument();
    expect(
      screen.getByText('Everyone on the project can read this discussion. Only the people you choose here are notified.')
    ).toBeInTheDocument();

    await writeFirstMessage();
    await start();

    await waitFor(() => expect(state.startThread).toHaveBeenCalled());
    // No recipients are sent, so the server notifies the whole project.
    expect(state.startThread.mock.calls[0][0]).not.toHaveProperty('notify_contact_ids');
    expect(state.messageSuccess).toHaveBeenCalledWith('Discussion started. Client users on this project are notified.');
    expect(onCreated).toHaveBeenCalledWith({ id: 'th-1' });
  });

  it('sends only the people chosen, and names them in the confirmation', async () => {
    renderModal();

    await userEvent.click(screen.getByRole('combobox', { name: 'Notify' }));
    await userEvent.click(await screen.findByText('Jamie Wu'));
    await writeFirstMessage();
    await start();

    await waitFor(() =>
      expect(state.startThread).toHaveBeenCalledWith(
        expect.objectContaining({ project_id: 'p-1', notify_contact_ids: ['u-2'] })
      )
    );
    expect(state.messageSuccess).toHaveBeenCalledWith('Discussion started. Jamie Wu notified.');
  });

  it('starts with the person it was opened for already chosen', async () => {
    renderModal({ initialRecipientIds: ['u-1'] });

    await writeFirstMessage();
    await start();

    await waitFor(() =>
      expect(state.startThread).toHaveBeenCalledWith(expect.objectContaining({ notify_contact_ids: ['u-1'] }))
    );
  });

  it('drops a recipient who is not on the project instead of sending them', async () => {
    renderModal({ initialRecipientIds: ['someone-on-another-project'] });

    await writeFirstMessage();
    await start();

    await waitFor(() => expect(state.startThread).toHaveBeenCalled());
    expect(state.startThread.mock.calls[0][0]).not.toHaveProperty('notify_contact_ids');
  });
});

describe('NewDiscussionModal: opened from a client or client user', () => {
  it('lists only that client’s portal projects, and only the ones the person can open', () => {
    state.projects = [
      { id: 'p-1', name: 'Website redesign' },
      { id: 'p-2', name: 'Brand refresh' },
    ];
    renderModal({
      projectId: undefined,
      organizationId: 'org-1',
      restrictToProjectIds: ['p-2'],
    });

    expect(state.projectsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ portal: 'on', organization_id: 'org-1' })
    );
    // One eligible project needs no choice: it is selected already.
    expect(screen.getByText('Brand refresh')).toBeInTheDocument();
    expect(screen.queryByText('Website redesign')).not.toBeInTheDocument();
  });
});

describe('NewDiscussionModal: attachments', () => {
  it('uploads a chosen file to the project and sends its id with the first message', async () => {
    renderModal();
    await writeFirstMessage();

    const file = new File(['hello'], 'brief.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByTestId('attachment-input'), file);

    expect(await screen.findByText('brief.pdf')).toBeInTheDocument();
    await waitFor(() => expect(state.confirm).toHaveBeenCalledWith({ projectId: 'p-1', fileId: 'f-1' }));
    expect(state.presign).toHaveBeenCalledWith({
      projectId: 'p-1',
      body: expect.objectContaining({ filename: 'brief.pdf', category: 'Supporting Document' }),
    });
    expect(state.upload).toHaveBeenCalledWith('https://upload.test/f-1', file, expect.any(Function));

    await start();
    await waitFor(() => expect(state.startThread).toHaveBeenCalledWith(expect.objectContaining({ attachment_file_ids: ['f-1'] })));
  });

  it('does not upload a blocked file type', async () => {
    renderModal();
    await userEvent.upload(screen.getByTestId('attachment-input'), new File(['x'], 'run.exe', { type: 'application/x-msdownload' }));

    expect(state.presign).not.toHaveBeenCalled();
    expect(screen.queryByText('run.exe')).not.toBeInTheDocument();
  });
});
