import { GroupedProject, ProjectGroupBy } from '@/types/project/project.types';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';

export const groupProjects = (
  projects: IProjectViewModel[],
  groupBy: ProjectGroupBy
): GroupedProject[] => {
  const grouped: Record<string, GroupedProject> = {};

  projects?.forEach(project => {
    let groupKey: string;
    let groupName: string;
    let groupColor: string;

    switch (groupBy) {
      case ProjectGroupBy.CLIENT:
        groupKey = project.client_name || 'No Client';
        groupName = groupKey;
        groupColor = '#688';
        break;
      case ProjectGroupBy.CATEGORY:
      default:
        groupKey = project.category_name || 'Uncategorized';
        groupName = groupKey;
        groupColor = project.category_color || '#888';
    }

    if (!grouped[groupKey]) {
      grouped[groupKey] = {
        groupKey,
        groupName,
        groupColor,
        projects: [],
        count: 0,
        totalProgress: 0,
        totalTasks: 0,
      };
    }

    grouped[groupKey].projects.push(project);
    grouped[groupKey].count++;
    grouped[groupKey].totalProgress += project.progress || 0;
    grouped[groupKey].totalTasks += project.task_count || 0;
  });

  return Object.values(grouped);
};
