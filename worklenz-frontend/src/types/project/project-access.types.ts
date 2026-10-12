import { IProjectPermissions } from '@/types/project/projectViewModel.types';

export interface ICachedProjectAccess {
  permissions: IProjectPermissions;
  isProjectManager: boolean;
  financeAccess: boolean;
  canCreateProjectsFromTemplates: boolean;
}

export const DENIED_PROJECT_PERMISSIONS: IProjectPermissions = {
  settings: false,
  statuses: false,
  phases: false,
  customColumns: false,
  members: {
    add: false,
    removeMember: false,
    changeMemberRole: false,
  },
  tasks: false,
  saveAsTemplate: false,
  finance: false,
  archive: false,
  delete: false,
  move: false,
  assignPm: false,
  insights: false,
  files: false,
  updates: false,
  roadmap: false,
  workload: false,
};

export const EMPTY_PROJECT_ACCESS: ICachedProjectAccess = {
  permissions: DENIED_PROJECT_PERMISSIONS,
  isProjectManager: false,
  financeAccess: false,
  canCreateProjectsFromTemplates: false,
};
