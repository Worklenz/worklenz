import {
  IProjectViewModel,
  IProjectPermissions,
} from '@/types/project/projectViewModel.types';
import {
  EMPTY_PROJECT_ACCESS,
  ICachedProjectAccess,
  DENIED_PROJECT_PERMISSIONS,
} from '@/types/project/project-access.types';

/**
 * Build a cached access record from a project GET payload.
 * Returns null when the payload has no permissions (caller may skip cache).
 */
export const extractProjectAccess = (
  project: IProjectViewModel | null | undefined
): ICachedProjectAccess | null => {
  if (!project?.id || !project.permissions) {
    return null;
  }

  return {
    permissions: project.permissions,
    isProjectManager: Boolean(project.is_project_manager),
    financeAccess: Boolean(
      project.finance_access ?? project.permissions.finance
    ),
    canCreateProjectsFromTemplates: Boolean(
      project.can_create_projects_from_templates
    ),
  };
};

/** Legacy fallback when permissions are missing (pre-Phase-1 responses). */
export const legacyProjectAccessFromManager = (
  project: IProjectViewModel | null | undefined,
  teamMemberId: string | undefined | null,
  isOwnerOrAdmin: boolean
): ICachedProjectAccess => {
  if (isOwnerOrAdmin) {
    const allTrue: IProjectPermissions = {
      settings: true,
      statuses: true,
      phases: true,
      customColumns: true,
      members: {
        add: true,
        removeMember: true,
        changeMemberRole: true,
      },
      tasks: true,
      saveAsTemplate: true,
      finance: true,
      archive: true,
      delete: true,
      move: true,
      assignPm: true,
      insights: true,
      files: true,
      updates: true,
      roadmap: true,
      workload: true,
    };
    return {
      permissions: allTrue,
      isProjectManager: false,
      financeAccess: true,
      canCreateProjectsFromTemplates: true,
    };
  }

  const isPm =
    !!teamMemberId && project?.project_manager?.id === teamMemberId;

  if (!isPm) {
    return EMPTY_PROJECT_ACCESS;
  }

  return {
    permissions: {
      ...DENIED_PROJECT_PERMISSIONS,
      settings: true,
      statuses: true,
      phases: true,
      customColumns: true,
      members: {
        add: true,
        removeMember: true,
        changeMemberRole: true,
      },
      tasks: true,
      saveAsTemplate: true,
      // Phase 7: legacy PM match must not imply finance (D7).
      finance: false,
      insights: true,
      files: true,
      updates: true,
      roadmap: true,
      workload: true,
    },
    isProjectManager: true,
    financeAccess: false,
    canCreateProjectsFromTemplates: false,
  };
};
