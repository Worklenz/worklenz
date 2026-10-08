import i18n from '@/i18n';
import type { ProjectType } from '@/types/project/projectViewModel.types';

export const isSoftwareProjectType = (
  projectType?: ProjectType | string | null
): boolean => projectType === 'software';

/**
 * Tab a project opens on from project lists. Software projects land on the
 * Backlog unless the member pinned the Board.
 */
export const getProjectDefaultTab = (
  defaultView?: string | null,
  projectType?: ProjectType | string | null
): string => {
  if (defaultView === 'BOARD') return 'board';
  return isSoftwareProjectType(projectType) ? 'backlog' : 'tasks-list';
};

export interface SoftwareProjectLabels {
  task: string;
  taskPlural: string;
  createTask: string;
  taskList: string;
  backlog: string;
  phase: string;
  phasePlural: string;
  managePhases: string;
  unmapped: string;
}

const translateTerm = (key: string, defaultValue: string): string =>
  i18n.t(`project-view:terminology.${key}`, { defaultValue });

export const getSoftwareProjectLabels = (
  projectType?: ProjectType | string | null
): SoftwareProjectLabels => {
  if (isSoftwareProjectType(projectType)) {
    return {
      task: translateTerm('issue', 'Issue'),
      taskPlural: translateTerm('issues', 'Issues'),
      createTask: translateTerm('createIssue', 'Create Issue'),
      taskList: translateTerm('issueList', 'List'),
      backlog: translateTerm('backlog', 'Backlog'),
      phase: translateTerm('sprint', 'Sprint'),
      phasePlural: translateTerm('sprints', 'Sprints'),
      managePhases: translateTerm('manageSprints', 'Manage Sprints'),
      unmapped: translateTerm('backlog', 'Backlog'),
    };
  }

  return {
    task: translateTerm('task', 'Task'),
    taskPlural: translateTerm('tasks', 'Tasks'),
    createTask: translateTerm('addTask', 'Add Task'),
    taskList: translateTerm('taskList', 'Task List'),
    backlog: translateTerm('backlog', 'Backlog'),
    phase: translateTerm('phase', 'Phase'),
    phasePlural: translateTerm('phases', 'Phases'),
    managePhases: translateTerm('managePhase', 'Manage Phase'),
    unmapped: translateTerm('unmapped', 'Unmapped'),
  };
};
