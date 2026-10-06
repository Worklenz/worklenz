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
