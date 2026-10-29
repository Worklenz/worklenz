import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  post: vi.fn(),
  toggleReaction: vi.fn(),
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
  messageWarning: vi.fn(),
  presign: vi.fn(),
  confirm: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
}));

const trigger =
  (fn: (...args: unknown[]) => unknown) =>
  (...args: unknown[]) => {
    const promise = Promise.resolve().then(() => fn(...args));
    return Object.assign(promise, { unwrap: () => promise });
  };

vi.mock('@/api/client-portal/portal-workflow-api', () => ({
  usePostThreadMessageMutation: () => [trigger(state.post), { isLoading: false }],
  useToggleThreadMessageReactionMutation: () => [trigger(state.toggleReaction), { isLoading: false }],
}));

vi.mock('@/api/client-portal/portal-projects-api', () => ({
  usePresignPortalFileMutation: () => [trigger(state.presign)],
  useConfirmPortalFileMutation: () => [trigger(state.confirm)],
  useGetFileDownloadLinkMutation: () => [trigger(state.download)],
}));

vi.mock('@/api/projects/project-files.api.service', () => ({ default: { uploadDirect: state.upload } }));

vi.mock('@/shared/antd-imports', async importOriginal => {
  const actual = await importOriginal<typeof import('@/shared/antd-imports')>();
  return {
    ...actual,
    message: { success: state.messageSuccess, error: state.messageError, warning: state.messageWarning, info: vi.fn() },
  };
});

// ProseMirror needs a real layout engine; a textarea plays the editor here.
vi.mock('./RichMessageEditor', async () => {
  const { RichMessageEditorStub } = await import('./richMessageEditorStub');
  return { RichMessageEditor: RichMessageEditorStub };
});

import type { ThreadMessage } from '@/types/client-portal/v2';
import { ThreadComposer } from './ThreadComposer';
import { ThreadMessages, renderMentions } from './ThreadMessages';

const audience = [
  { id: 'u-1', name: 'Alex Rivera' },
  { id: 'u-2', name: 'Jamie Wu' },
];

const members = [{ id: 'm-1', name: 'Sam Patel' }];

const composerBox = () => screen.getByRole('textbox') as HTMLTextAreaElement;

/** Picks a person from the @ suggestions, as a user would. */
const pickMention = async (name: string) => {
  await userEvent.click(screen.getByRole('button', { name: `Mention ${name}` }));
};

beforeEach(() => {
  vi.clearAllMocks();
  state.post.mockResolvedValue({ body: { notified: ['Alex Rivera'], message: {} } });
  state.toggleReaction.mockResolvedValue({ body: { added: true, emoji: '👍' } });
  state.presign.mockResolvedValue({ body: { file_id: 'f-1', upload_url: 'https://upload.test/f-1', expires_in: 900 } });
  state.confirm.mockResolvedValue({ body: { id: 'f-1' } });
  state.upload.mockResolvedValue(undefined);
  state.download.mockResolvedValue({ body: { url: 'https://files.test/signed', expires_in: 3600 } });
});

describe('ThreadComposer', () => {
  it('defaults to a client-visible reply and says exactly who will see it', () => {
    render(<ThreadComposer threadId="th-1" projectId="p-1" audience={audience} />);

    expect(screen.getByText('Visible to Alex, Jamie and your team')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^Reply to the client…/)).toBeInTheDocument();
  });

  it('says only the mentioned person is notified, and reverts once the mention is removed', async () => {
    render(<ThreadComposer threadId="th-1" projectId="p-1" audience={audience} members={members} />);

    await pickMention('Alex Rivera');
    expect(composerBox().value).toBe('@Alex Rivera ');
    expect(screen.getByText('Visible to everyone on the project. Only Alex will be notified.')).toBeInTheDocument();

    fireEvent.change(composerBox(), { target: { value: 'Thanks all' } });
    expect(screen.getByText('Visible to Alex, Jamie and your team')).toBeInTheDocument();
  });

  it('does not treat typed text as a mention unless it was picked from the list', () => {
    render(<ThreadComposer threadId="th-1" projectId="p-1" audience={audience} />);

    fireEvent.change(composerBox(), { target: { value: 'Thanks @Alex Rivera' } });
    expect(screen.getByText('Visible to Alex, Jamie and your team')).toBeInTheDocument();
  });

  it('sends the rich-text HTML and mention_ids for a client-visible reply, never team members', async () => {
    render(<ThreadComposer threadId="th-1" projectId="p-1" audience={audience} members={members} />);

    expect(screen.queryByRole('button', { name: 'Mention Sam Patel' })).not.toBeInTheDocument();
    await pickMention('Alex Rivera');
    fireEvent.change(composerBox(), { target: { value: '@Alex Rivera shared v3.' } });
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(state.post).toHaveBeenCalledWith({
        threadId: 'th-1',
        body: { visibility: 'client', text: '<p>@Alex Rivera shared v3.</p>', mention_ids: ['u-1'] },
      })
    );
    await waitFor(() => expect(state.messageSuccess).toHaveBeenCalledWith('Reply sent. Alex Rivera notified.'));
  });

  it('suggests project members, not client users, in an internal comment and sends mention_user_ids', async () => {
    render(<ThreadComposer threadId="th-1" projectId="p-1" audience={audience} members={members} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Internal comment' }));
    expect(screen.getByText('Only your team can see this')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Mention Alex Rivera' })).not.toBeInTheDocument();
    await pickMention('Sam Patel');
    fireEvent.change(composerBox(), { target: { value: '@Sam Patel please check the margin.' } });
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(state.post).toHaveBeenCalledWith({
        threadId: 'th-1',
        body: { visibility: 'internal', text: '<p>@Sam Patel please check the margin.</p>', mention_user_ids: ['m-1'] },
      })
    );
    expect(state.messageSuccess).toHaveBeenCalledWith('Internal comment saved. The client cannot see it.');
  });

  it('drops a pick from the other mode when the audience is switched', async () => {
    render(<ThreadComposer threadId="th-1" projectId="p-1" audience={audience} members={members} />);

    await pickMention('Alex Rivera');
    await userEvent.click(screen.getByRole('radio', { name: 'Internal comment' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(state.post).toHaveBeenCalledWith({
        threadId: 'th-1',
        body: { visibility: 'internal', text: '<p>@Alex Rivera </p>' },
      })
    );
  });

  it('keeps Send disabled for an empty message, and sends on Ctrl+Enter', async () => {
    render(<ThreadComposer threadId="th-1" projectId="p-1" audience={audience} />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();

    fireEvent.change(composerBox(), { target: { value: 'Hello' } });
    fireEvent.keyDown(composerBox(), { key: 'Enter', code: 'Enter' });
    expect(state.post).not.toHaveBeenCalled();

    fireEvent.keyDown(composerBox(), { key: 'Enter', code: 'Enter', ctrlKey: true });
    await waitFor(() => expect(state.post).toHaveBeenCalledTimes(1));
  });

  it('blocks a message over the length limit', () => {
    render(<ThreadComposer threadId="th-1" projectId="p-1" audience={audience} />);

    fireEvent.change(composerBox(), { target: { value: 'a'.repeat(4001) } });
    expect(screen.getByText('A message can be at most 4000 characters.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('uploads attached files, sends their ids, and lets a message be only files', async () => {
    render(<ThreadComposer threadId="th-1" projectId="p-1" audience={audience} />);

    await userEvent.upload(screen.getByTestId('attachment-input'), new File(['x'], 'spec.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText('spec.pdf')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled());

    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(state.post).toHaveBeenCalledWith({
        threadId: 'th-1',
        body: { visibility: 'client', text: '', attachment_file_ids: ['f-1'] },
      })
    );
    await waitFor(() => expect(screen.queryByText('spec.pdf')).not.toBeInTheDocument());
  });

  it('holds Send while a file uploads, and drops a file that is removed', async () => {
    state.upload.mockReturnValue(new Promise(() => undefined));
    render(<ThreadComposer threadId="th-1" projectId="p-1" audience={audience} />);

    fireEvent.change(composerBox(), { target: { value: 'Here you go' } });
    await userEvent.upload(screen.getByTestId('attachment-input'), new File(['x'], 'big.zip', { type: 'application/zip' }));
    expect(await screen.findByText('big.zip')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Remove big.zip' }));
    expect(screen.queryByText('big.zip')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('allows at most 5 files', async () => {
    render(<ThreadComposer threadId="th-1" projectId="p-1" audience={audience} />);

    const files = Array.from({ length: 6 }, (_, index) => new File(['x'], `f${index}.txt`, { type: 'text/plain' }));
    await userEvent.upload(screen.getByTestId('attachment-input'), files);

    await waitFor(() => expect(state.presign).toHaveBeenCalledTimes(5));
    expect(state.messageWarning).toHaveBeenCalledWith('You can attach at most 5 files.');
  });

  it('says so when nobody on the project can see a client-visible reply', () => {
    render(<ThreadComposer threadId="th-1" projectId="p-1" audience={[]} />);

    expect(
      screen.getByText('Visible to your team. No active client users on this project.')
    ).toBeInTheDocument();
  });
});

describe('ThreadMessages', () => {
  const message = (overrides: Partial<ThreadMessage>): ThreadMessage => ({
    id: 'm-1',
    author: 'Alex Rivera',
    side: 'client',
    visibility: 'client',
    text: 'Looks good',
    at: '2026-06-02T09:00:00Z',
    mentions: [],
    attachments: [],
    ...overrides,
  });

  it('marks client messages as Client and internal comments as Internal, visible only to the team', () => {
    render(
      <ThreadMessages
        messages={[
          message({ id: 'm-1' }),
          message({ id: 'm-2', author: 'Taylor', side: 'internal', visibility: 'internal', text: 'Margin note' }),
        ]}
      />
    );

    expect(screen.getByText('Client')).toBeInTheDocument();
    expect(screen.getByText('Internal')).toBeInTheDocument();
    expect(screen.getByText(/only your team sees this/)).toBeInTheDocument();
  });

  it('renders rich text as formatted HTML and strips anything unsafe', () => {
    const { container } = render(
      <ThreadMessages
        messages={[
          message({
            text: '<h1>Plan</h1><p><strong>bold</strong> <em>it</em></p><ul><li>one</li></ul><ol><li>two</li></ol><script>alert(1)</script><a href="javascript:alert(1)">x</a>',
          }),
        ]}
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Plan' })).toBeInTheDocument();
    expect(container.querySelector('strong')).toHaveTextContent('bold');
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
  });

  it('renders an @mention chip and opens links safely', () => {
    const { container } = render(
      <ThreadMessages
        messages={[
          message({
            text: '<p><span class="mention" data-type="mention" data-id="u-1" data-label="Alex Rivera">@Alex Rivera</span> see <a href="https://example.com">this</a></p>',
          }),
        ]}
      />
    );

    expect(container.querySelector('.mention')).toHaveTextContent('@Alex Rivera');
    const link = container.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('shows images inline and other files as chips, and both download', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    render(
      <ThreadMessages
        messages={[
          message({
            text: '<p></p>',
            attachments: [
              { id: 'a-1', file_id: 'f-1', name: 'mock.png', type: 'png', size: 2048 },
              { id: 'a-2', file_id: 'f-2', name: 'brief.pdf', type: 'pdf', size: 4096 },
              { id: 'a-3', file_id: null, name: 'gone.zip', type: 'zip', size: 10 },
            ],
          }),
        ]}
      />
    );

    const image = await screen.findByRole('img', { name: 'mock.png' });
    expect(image).toHaveAttribute('src', 'https://files.test/signed');
    expect(screen.getByRole('button', { name: 'Download brief.pdf' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download gone.zip' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Download brief.pdf' }));
    await waitFor(() => expect(openSpy).toHaveBeenCalledWith('https://files.test/signed', '_blank', 'noopener,noreferrer'));
    openSpy.mockRestore();
  });

  it('still renders messages from before rich text as plain text', () => {
    render(<ThreadMessages messages={[message({ text: 'Looks good\nSee a < b' })]} />);

    expect(screen.getByText(/Looks good/)).toHaveStyle({ whiteSpace: 'pre-wrap' });
  });

  it('highlights only the mentions a message actually recorded', () => {
    const parts = renderMentions('Thanks @Alex Rivera and @Someone Else', ['Alex Rivera'], {
      background: 'x',
      color: 'y',
    });
    render(<div data-testid="out">{parts}</div>);

    const out = screen.getByTestId('out');
    expect(out.querySelectorAll('span')).toHaveLength(1);
    expect(out.querySelector('span')).toHaveTextContent('@Alex Rivera');
  });
  it('renders reaction badges with count and toggles when clicked', async () => {
    render(
      <ThreadMessages
        threadId="th-1"
        messages={[
          message({
            id: 'm-1',
            reactions: [
              {
                emoji: '👍',
                count: 2,
                has_reacted: true,
                users: [
                  { id: 'u-1', name: 'Alex Rivera', side: 'client' },
                  { id: 'm-1', name: 'Sam Patel', side: 'internal' },
                ],
              },
            ],
          }),
        ]}
      />
    );

    const badge = screen.getByRole('button', { name: '👍 2' });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(badge);
    expect(state.toggleReaction).toHaveBeenCalledWith({
      messageId: 'm-1',
      emoji: '👍',
      threadId: 'th-1',
    });
  });

  it('allows picking a new emoji reaction from the picker', async () => {
    render(
      <ThreadMessages
        threadId="th-1"
        messages={[message({ id: 'm-1', reactions: [] })]}
      />
    );

    const addBtn = screen.getByRole('button', { name: 'Add reaction' });
    await userEvent.click(addBtn);

    const heartBtn = await screen.findByRole('button', { name: '❤️' });
    await userEvent.click(heartBtn);

    expect(state.toggleReaction).toHaveBeenCalledWith({
      messageId: 'm-1',
      emoji: '❤️',
      threadId: 'th-1',
    });
  });

  it('shows error message if toggle reaction fails', async () => {
    state.toggleReaction.mockRejectedValueOnce(new Error('Network error'));

    render(
      <ThreadMessages
        threadId="th-1"
        messages={[
          message({
            id: 'm-1',
            reactions: [{ emoji: '🎉', count: 1, has_reacted: false, users: [{ id: 'u-1', name: 'Alex', side: 'client' }] }],
          }),
        ]}
      />
    );

    const badge = screen.getByRole('button', { name: '🎉 1' });
    await userEvent.click(badge);

    expect(state.messageError).toHaveBeenCalledWith('Could not update reaction.');
  });
});
