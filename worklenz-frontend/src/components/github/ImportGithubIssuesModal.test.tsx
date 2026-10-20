import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetIssues = vi.fn();
const mockImport = vi.fn();

vi.mock('@/api/github/github.api.service', () => ({
  githubApiService: {
    getRepositoryIssues: (...args: unknown[]) => mockGetIssues(...args),
    importIssues: (...args: unknown[]) => mockImport(...args),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: Record<string, unknown>) =>
      String(options?.defaultValue ?? '')
        .replace('{{key}}', String(options?.key ?? ''))
        .replace('{{name}}', String(options?.name ?? ''))
        .replace('{{count}}', String(options?.count ?? '')),
  }),
}));

import { ImportGithubIssuesModal } from './ImportGithubIssuesModal';

const issue = (number: number, extra: Record<string, unknown> = {}) => ({
  number,
  title: `Issue ${number}`,
  state: 'open',
  html_url: `https://github.com/acme/web/issues/${number}`,
  labels: ['bug'],
  assignee_login: null,
  created_at: '2026-10-01T00:00:00Z',
  imported_task_key: null,
  ...extra,
});

const renderModal = () =>
  render(
    <ImportGithubIssuesModal
      open
      projectId="p1"
      linkId="l1"
      repositoryName="acme/web"
      sprints={[{ id: 's1', name: 'Sprint 1', sprint_status: 'planned' }]}
      onClose={vi.fn()}
      onImported={vi.fn()}
    />
  );

describe('ImportGithubIssuesModal', () => {
  beforeEach(() => {
    mockGetIssues.mockReset();
    mockImport.mockReset();
  });

  it('lists issues and marks already imported ones', async () => {
    mockGetIssues.mockResolvedValue({
      done: true,
      body: {
        has_more: false,
        issues: [issue(1), issue(2, { imported_task_key: 'WEB-9' })],
      },
    });
    renderModal();

    expect(await screen.findByText('Issue 1')).toBeTruthy();
    expect(screen.getByText('Imported as WEB-9')).toBeTruthy();
    expect(mockGetIssues).toHaveBeenCalledWith('p1', 'l1', {
      state: 'open',
      labels: [],
      page: 1,
    });
  });

  it('shows a retry action when loading fails', async () => {
    mockGetIssues.mockRejectedValue(new Error('boom'));
    renderModal();

    await waitFor(() => expect(screen.getByText('Retry')).toBeTruthy());
  });
});
