/**
 * Permission Levels and Templates for client company users.
 *
 * Defined once here and consumed identically by Assign Projects, the Add Client wizard and (later)
 * the Portal Settings panel. The backend only validates the level keys.
 *
 * Levels are stored and displayed only for now: the client-facing API still scopes by company.
 */

export type PermissionLevel = 'view' | 'comment' | 'contributor';

export type PermissionTemplateKey = 'view_only' | 'standard_contact' | 'full_partner';

export interface PermissionLevelDefinition {
  key: PermissionLevel;
  /** i18n keys are resolved in the `client-portal-company-users` namespace. */
  labelKey: string;
  labelDefault: string;
  descriptionKey: string;
  descriptionDefault: string;
}

export interface PermissionTemplateDefinition {
  key: PermissionTemplateKey;
  nameKey: string;
  nameDefault: string;
  descriptionKey: string;
  descriptionDefault: string;
  /** Each template maps to exactly one level and applies it to every current project. */
  level: PermissionLevel;
}

export const PERMISSION_LEVELS: PermissionLevelDefinition[] = [
  {
    key: 'view',
    labelKey: 'permissionLevels.view.label',
    labelDefault: 'View only',
    descriptionKey: 'permissionLevels.view.description',
    descriptionDefault:
      'Status, milestones, tasks and deliverables. No comments, edits or uploads.',
  },
  {
    key: 'comment',
    labelKey: 'permissionLevels.comment.label',
    labelDefault: 'View + comment',
    descriptionKey: 'permissionLevels.comment.description',
    descriptionDefault:
      'Comment, approve or reject and attach files to comments. Cannot create tasks.',
  },
  {
    key: 'contributor',
    labelKey: 'permissionLevels.contributor.label',
    labelDefault: 'Full contributor',
    descriptionKey: 'permissionLevels.contributor.description',
    descriptionDefault:
      'Everything above, plus create and edit tasks, change status and upload attachments.',
  },
];

export const PERMISSION_TEMPLATES: PermissionTemplateDefinition[] = [
  {
    key: 'view_only',
    nameKey: 'permissionTemplates.view_only.name',
    nameDefault: 'View Only',
    descriptionKey: 'permissionTemplates.view_only.description',
    descriptionDefault:
      'Stakeholders who just need visibility: status and deliverables, no editing.',
    level: 'view',
  },
  {
    key: 'standard_contact',
    nameKey: 'permissionTemplates.standard_contact.name',
    nameDefault: 'Standard Contact',
    descriptionKey: 'permissionTemplates.standard_contact.description',
    descriptionDefault:
      'The default for most client contacts: can comment, approve or reject and attach files.',
    level: 'comment',
  },
  {
    key: 'full_partner',
    nameKey: 'permissionTemplates.full_partner.name',
    nameDefault: 'Full Partner',
    descriptionKey: 'permissionTemplates.full_partner.description',
    descriptionDefault: 'Hands-on collaborators: can create and edit tasks and upload attachments.',
    level: 'contributor',
  },
];

export const getPermissionLevel = (key: string): PermissionLevelDefinition | undefined =>
  PERMISSION_LEVELS.find(level => level.key === key);

export const getPermissionTemplate = (key: string): PermissionTemplateDefinition | undefined =>
  PERMISSION_TEMPLATES.find(template => template.key === key);

/** A project's id mapped to the level a user holds on it. */
export type ProjectAccessMap = Record<string, PermissionLevel>;

/**
 * Applies a template: every one of the company's current projects at the template's level. It
 * replaces whatever was selected before, so projects added later are not covered until re-applied.
 */
export const applyPermissionTemplate = (
  template: PermissionTemplateDefinition,
  projectIds: string[]
): ProjectAccessMap =>
  projectIds.reduce<ProjectAccessMap>((access, projectId) => {
    access[projectId] = template.level;
    return access;
  }, {});

/** Sets one level on every project in the current selection, leaving other projects out. */
export const applyLevelToSelection = (
  access: ProjectAccessMap,
  level: PermissionLevel
): ProjectAccessMap =>
  Object.keys(access).reduce<ProjectAccessMap>((next, projectId) => {
    next[projectId] = level;
    return next;
  }, {});

/**
 * "Select all" toggles: when every project is already selected it clears the selection, otherwise it
 * adds the missing ones at "view" and keeps the levels already chosen.
 */
export const toggleSelectAll = (
  access: ProjectAccessMap,
  projectIds: string[]
): ProjectAccessMap => {
  const allSelected = projectIds.length > 0 && projectIds.every(projectId => projectId in access);
  if (allSelected) return {};

  return projectIds.reduce<ProjectAccessMap>(
    (next, projectId) => {
      if (!(projectId in next)) next[projectId] = 'view';
      return next;
    },
    { ...access }
  );
};

/** Converts the map to the `{ project_id, level }` list the API takes. */
export const toProjectAccessPayload = (
  access: ProjectAccessMap
): Array<{ project_id: string; level: PermissionLevel }> =>
  Object.entries(access).map(([project_id, level]) => ({ project_id, level }));
