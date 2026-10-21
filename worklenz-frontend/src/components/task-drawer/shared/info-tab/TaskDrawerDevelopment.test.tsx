import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTaskDevelopment = vi.fn();

vi.mock('@/api/github/github.api.service', () => ({
  githubApiService: {
    getTaskDevelopment: (...args: unknown[]) => mockGetTaskDevelopment(...args),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string; key?: string; count?: number }) =>
      (options?.defaultValue || '')
        .replace('{{key}}', options?.key ?? '')
        .replace('{{count}}', String(options?.count ?? '')),
  }),
}));

import TaskDrawerDevelopment from './TaskDrawerDevelopment';

const emptyData = {
  has_linked_repositories: true,
  branches: [],
  pull_requests: [],
  commits: [],
};

describe('TaskDrawerDevelopment', () => {
  beforeEach(() => {
    mockGetTaskDevelopment.mockReset();
  });

  it('explains how to link activity when nothing is linked yet', async () => {
    mockGetTaskDevelopment.mockResolvedValue({ done: true, body: emptyData });
    render(<TaskDrawerDevelopment taskId="task-1" taskKey="WEB-12" />);

    expect(await screen.findByText(/Include WEB-12 in a branch name/)).toBeTruthy();
  });

  it('points to project settings when no repository is linked', async () => {
    mockGetTaskDevelopment.mockResolvedValue({
      done: true,
      body: { ...emptyData, has_linked_repositories: false },
    });
    render(<TaskDrawerDevelopment taskId="task-1" taskKey="WEB-12" />);

    expect(await screen.findByText(/No repository is linked to this project/)).toBeTruthy();
  });

  it('renders pull requests with their state', async () => {
    mockGetTaskDevelopment.mockResolvedValue({
      done: true,
      body: {
        ...emptyData,
        pull_requests: [
          {
            id: 'pr-1',
            number: 42,
            title: 'Add login',
            state: 'closed',
            is_draft: false,
            merged: true,
            review_state: null,
            head_branch: 'feature/WEB-12-login',
            base_branch: 'main',
            author_login: 'dev',
            author_avatar_url: null,
            html_url: 'https://github.com/acme/web/pull/42',
            opened_at: null,
            merged_at: null,
            closed_at: null,
            closes: true,
            repository: 'acme/web',
          },
        ],
      },
    });
    render(<TaskDrawerDevelopment taskId="task-1" taskKey="WEB-12" />);

    expect(await screen.findByText('#42 Add login')).toBeTruthy();
    expect(screen.getByText('Merged')).toBeTruthy();
  });

  it('shows a retry action when loading fails', async () => {
    mockGetTaskDevelopment.mockRejectedValue(new Error('boom'));
    render(<TaskDrawerDevelopment taskId="task-1" />);

    await waitFor(() => expect(screen.getByText('Retry')).toBeTruthy());
  });
});
