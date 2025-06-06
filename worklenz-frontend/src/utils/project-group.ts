// Updated project-group.ts
import { GroupedProject } from "@/types/project/project.types";
import { IProjectViewModel } from "@/types/project/projectViewModel.types";

export const groupProjectsByCategory = (projects: IProjectViewModel[]): GroupedProject[] => {
  const grouped: Record<string, GroupedProject> = {};

  projects?.forEach(project => {
    const categoryName = project.category_name || 'Uncategorized';
    const categoryColor = project.category_color || '#888';
    
    if (!grouped[categoryName]) {
      grouped[categoryName] = {
        groupKey: categoryName,
        groupName: categoryName,
        groupColor: categoryColor,
        projects: [],
        count: 0,
        totalProgress: 0,
        totalTasks: 0
      };
    }

    grouped[categoryName].projects.push(project);
    grouped[categoryName].count++;
    grouped[categoryName].totalProgress += project.progress || 0;
    grouped[categoryName].totalTasks += project.task_count || 0;
  });

  // Calculate average progress for each category
  Object.values(grouped).forEach(group => {
    group.averageProgress = group.count > 0 ? Math.round(group.totalProgress / group.count) : 0;
  });

  return Object.values(grouped);
};

export const groupProjectsByClient = (projects: IProjectViewModel[]): GroupedProject[] => {
  const grouped: Record<string, GroupedProject> = {};

  projects?.forEach(project => {
    const clientName = project.client_name || 'No Client';
    const clientKey = project.client_id || 'no-client';
    
    if (!grouped[clientKey]) {
      grouped[clientKey] = {
        groupKey: clientKey,
        groupName: clientName,
        groupColor: '#4A90E2', // Default blue color for clients
        projects: [],
        count: 0,
        totalProgress: 0,
        totalTasks: 0
      };
    }

    grouped[clientKey].projects.push(project);
    grouped[clientKey].count++;
    grouped[clientKey].totalProgress += project.progress || 0;
    grouped[clientKey].totalTasks += project.task_count || 0;
  });

  // Calculate average progress for each client
  Object.values(grouped).forEach(group => {
    group.averageProgress = group.count > 0 ? Math.round(group.totalProgress / group.count) : 0;
  });

  return Object.values(grouped);
};