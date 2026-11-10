import { describe, expect, it } from 'vitest';

import {
  getProjectDefaultTab,
  isSoftwareProjectType,
  isSoftwareSprintSetupRequired,
} from './software-project';

describe('isSoftwareSprintSetupRequired', () => {
  it('never locks the backlog (setup gate removed)', () => {
    expect(isSoftwareSprintSetupRequired('software', 0)).toBe(false);
    expect(isSoftwareSprintSetupRequired('software', 1)).toBe(false);
    expect(isSoftwareSprintSetupRequired('general', 0)).toBe(false);
  });

  it('still detects software project type', () => {
    expect(isSoftwareProjectType('software')).toBe(true);
    expect(isSoftwareProjectType('general')).toBe(false);
  });
});

describe('getProjectDefaultTab', () => {
  it('opens software projects on the backlog unless the board is pinned', () => {
    expect(getProjectDefaultTab(undefined, 'software')).toBe('backlog');
    expect(getProjectDefaultTab('TASK_LIST', 'software')).toBe('backlog');
    expect(getProjectDefaultTab('BOARD', 'software')).toBe('board');
  });

  it('opens general projects on the task list unless the board is pinned', () => {
    expect(getProjectDefaultTab(undefined, 'general')).toBe('tasks-list');
    expect(getProjectDefaultTab('BOARD', 'general')).toBe('board');
  });
});
