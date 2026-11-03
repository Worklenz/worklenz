import db from '../config/db';
import { processGithubEvent, refreshTrackedPullRequests } from '../services/github/github-event-processor';
import { GithubAppService } from '../services/github/github-app.service';
import { reconcileTasks } from '../services/github/github-automation.service';

jest.mock('../config/db', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../services/github/github-automation.service', () => ({
  reconcileTasks: jest.fn(), notifyGithubActivity: jest.fn(), closeTaskForClosedIssue: jest.fn(),
}));
jest.mock('../services/github/github-app.service', () => ({ GithubAppService: { getPullRequest: jest.fn() } }));

const query = db.query as jest.Mock;
const payload = {
  installation: { id: 10 },
  repository: { id: 20, full_name: 'org/repo', default_branch: 'main', private: false },
  pull_request: { number: 1, title: 'change', body: null, head: { ref: 'feature' }, state: 'closed', merged: true, html_url: 'url', updated_at: '2026-01-01T00:00:00Z' },
};

beforeEach(() => jest.clearAllMocks());

test('removes obsolete task references and reconciles formerly linked tasks', async () => {
  query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'integration' }] })
    .mockResolvedValueOnce({ rows: [{ id: 'repo' }] })
    .mockResolvedValueOnce({ rows: [{ project_id: 'project', project_key: 'PROJ' }] })
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'pr' }] })
    .mockResolvedValueOnce({ rows: [{ id: 'pr' }] })
    .mockResolvedValueOnce({ rows: [{ task_id: 'old-task' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] });
  await processGithubEvent('pull_request', payload);
  expect(query.mock.calls[6][0]).toContain('DELETE FROM github_task_links');
  expect(query.mock.calls[6][1]).toEqual(['pr', []]);
  expect(reconcileTasks).toHaveBeenCalledWith(['old-task'], 'repo', undefined);
});

test('ignores stale PR events before changing links', async () => {
  query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'integration' }] })
    .mockResolvedValueOnce({ rows: [{ id: 'repo' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'pr' }] })
    .mockResolvedValueOnce({ rows: [] });
  await processGithubEvent('pull_request', payload);
  expect(query).toHaveBeenCalledTimes(5);
  expect(reconcileTasks).not.toHaveBeenCalled();
});

test('refresh propagates GitHub failures so reconnect can be retried', async () => {
  query.mockResolvedValueOnce({ rows: [{ github_repo_id: 20, full_name: 'org/repo', number: 1 }] });
  (GithubAppService.getPullRequest as jest.Mock).mockRejectedValueOnce(new Error('GitHub unavailable'));
  await expect(refreshTrackedPullRequests('integration', 10)).rejects.toThrow('GitHub unavailable');
});
