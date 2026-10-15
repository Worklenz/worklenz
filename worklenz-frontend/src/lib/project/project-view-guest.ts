import { IProjectViewModel } from '@/types/project/projectViewModel.types';

/**
 * Check if user is a guest in the project
 * A guest user can access Task List, Board, Members, Roadmap, and Workload views
 * @param currentProject - The project data
 * @returns true if user is a guest, false otherwise
 */
export const isUserGuest = (currentProject?: IProjectViewModel | null): boolean => {
  // Check if project has is_guest flag (to be added to project response)
  if (currentProject && typeof currentProject === 'object' && 'is_guest' in currentProject) {
    return (currentProject as any).is_guest === true;
  }
  return false;
};

type ProjectRoleContext = Pick<IProjectViewModel, 'is_guest' | 'role_permissions'> | null | undefined;

/**
 * Task editing is read-only for guests unless the default permission scheme
 * grants their role "Edit tasks". Older responses without role_permissions
 * keep the plain guest rule.
 */
export const isProjectTaskEditingReadOnly = (project: ProjectRoleContext): boolean => {
  if (project?.role_permissions) return !project.role_permissions.edit_tasks;
  return project?.is_guest === true;
};

/** Older responses without `create_tasks` fall back to the "Edit tasks" rule. */
export const canCreateProjectTasks = (project: ProjectRoleContext): boolean => {
  if (typeof project?.role_permissions?.create_tasks === 'boolean') {
    return project.role_permissions.create_tasks;
  }
  return !isProjectTaskEditingReadOnly(project);
};

export const canDeleteProjectTasks = (project: ProjectRoleContext): boolean => {
  if (project?.role_permissions) return project.role_permissions.delete_tasks;
  return project?.is_guest !== true;
};

export const canCommentOnProjectTasks = (project: ProjectRoleContext): boolean =>
  project?.role_permissions?.comment ?? true;
