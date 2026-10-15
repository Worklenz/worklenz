import type { ProjectTab } from '@/utils/targets';

export const TAB_LABELS: Record<ProjectTab, { key: string; label: string }> = {
  overview: { key: 'projects.tabs.overview', label: 'Overview' },
  milestones: { key: 'projects.tabs.milestones', label: 'Milestones' },
  tasks: { key: 'projects.tabs.tasks', label: 'Tasks' },
  files: { key: 'projects.tabs.files', label: 'Files' },
  discussions: { key: 'projects.tabs.discussions', label: 'Discussions' },
};