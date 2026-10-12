import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IHomeMention } from '@/api/home-page/home-page.api.service';
import taskCommentsApiService from '@/api/tasks/task-comments.api.service';
import { HomeMentionsWidget } from './HomeMentionsWidget';

// No i18n instance in tests: resolve each key to its `defaultValue`, interpolating {{vars}}.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, string> = {}) =>
      (options.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => options[name] ?? ''),
  }),
}));

const mentionsQuery = vi.hoisted(() => ({ current: [] as unknown[] }));
vi.mock('@/api/home-page/home-page.api.service', () => ({
  useGetHomeMentionsQuery: () => ({
    data: { body: mentionsQuery.current },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/api/tasks/task-comments.api.service', () => ({ default: { create: vi.fn() } }));

const openTask = vi.hoisted(() => vi.fn());
vi.mock('../home-widgets/useOpenHomeTask', () => ({ useOpenHomeTask: () => openTask }));

const makeMention = (overrides: Partial<IHomeMention>): IHomeMention => ({
  id: 'c1',
  task_id: 't1',
  task_name: 'Fix login',
  project_id: 'p1',
  project_name: 'Web app',
  project_color: null,
  author_team_member_id: 'tm1',
  author_name: 'Alice Smith',
  author_avatar_url: null,
  excerpt: '@Me can you check this?',
  created_at: new Date().toISOString(),
  ...overrides,
});

const create = vi.mocked(taskCommentsApiService.create);

beforeEach(() => {
  vi.clearAllMocks();
  mentionsQuery.current = [
    makeMention({}),
    makeMention({
      id: 'c2',
      task_id: 't2',
      task_name: 'Ship it',
      author_team_member_id: 'tm2',
      author_name: 'Bob Jones',
      excerpt: '@Me is this ready?',
    }),
  ];
  create.mockResolvedValue({ done: true, body: {}, message: '' } as never);
});

const replyBox = (name: string) => screen.getByRole('textbox', { name: `Reply to ${name}` });

describe('HomeMentionsWidget replies', () => {
  it('offers a Reply link under each comment', () => {
    render(<HomeMentionsWidget />);
    expect(screen.getByRole('button', { name: 'Reply to Alice Smith' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reply to Bob Jones' })).toBeInTheDocument();
  });

  it('replying does not open the task, but clicking the comment still does', async () => {
    const user = userEvent.setup();
    render(<HomeMentionsWidget />);

    await user.click(screen.getByRole('button', { name: 'Reply to Alice Smith' }));
    expect(openTask).not.toHaveBeenCalled();

    await user.click(screen.getByText('@Me can you check this?'));
    expect(openTask).toHaveBeenCalledWith('t1', 'p1');
  });

  it('opens a reply box that starts with an @mention of its author and says where the reply goes', async () => {
    const user = userEvent.setup();
    render(<HomeMentionsWidget />);
    await user.click(screen.getByRole('button', { name: 'Reply to Alice Smith' }));

    expect(replyBox('Alice Smith')).toHaveValue('@Alice Smith ');
    expect(screen.getByText('Posted as a comment on “Fix login”.')).toBeInTheDocument();
    // Nothing but the @mention is not a reply yet.
    expect(screen.getByRole('button', { name: 'Reply' })).toBeDisabled();
  });

  it('adds the reply as a comment on that comment’s task, mentioning its author', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    document.addEventListener('task-comment-create', onCreated);
    render(<HomeMentionsWidget />);

    await user.click(screen.getByRole('button', { name: 'Reply to Alice Smith' }));
    await user.type(replyBox('Alice Smith'), 'Looking now!');
    await user.click(screen.getByRole('button', { name: 'Reply' }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith({
      task_id: 't1',
      content: '@Alice Smith Looking now!',
      mentions: [{ team_member_id: 'tm1', name: 'Alice Smith' }],
      attachments: [],
    });
    // An open task drawer for that task is told, so it shows the new comment.
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect((onCreated.mock.calls[0][0] as CustomEvent).detail).toEqual({ taskId: 't1' });
    // And the box goes away, leaving the Reply link again.
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    expect(screen.getByRole('button', { name: 'Reply to Alice Smith' })).toBeInTheDocument();
    document.removeEventListener('task-comment-create', onCreated);
  });

  it('does not notify the author when the @mention has been deleted from the reply', async () => {
    const user = userEvent.setup();
    render(<HomeMentionsWidget />);

    await user.click(screen.getByRole('button', { name: 'Reply to Bob Jones' }));
    const box = replyBox('Bob Jones');
    await user.clear(box);
    await user.type(box, 'Done, thanks');
    await user.click(screen.getByRole('button', { name: 'Reply' }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith({ task_id: 't2', content: 'Done, thanks', mentions: [], attachments: [] });
  });

  it('keeps what was typed when the reply could not be posted, and lets it be sent again', async () => {
    const user = userEvent.setup();
    create.mockRejectedValueOnce(new Error('network'));
    render(<HomeMentionsWidget />);

    await user.click(screen.getByRole('button', { name: 'Reply to Alice Smith' }));
    await user.type(replyBox('Alice Smith'), 'Will do');
    await user.click(screen.getByRole('button', { name: 'Reply' }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(replyBox('Alice Smith')).toHaveValue('@Alice Smith Will do');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reply' })).toBeEnabled());

    await user.click(screen.getByRole('button', { name: 'Reply' }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
  });

  it('cancels without posting, and has one reply box open at a time', async () => {
    const user = userEvent.setup();
    render(<HomeMentionsWidget />);

    await user.click(screen.getByRole('button', { name: 'Reply to Alice Smith' }));
    await user.click(screen.getByRole('button', { name: 'Reply to Bob Jones' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(replyBox('Bob Jones')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});
