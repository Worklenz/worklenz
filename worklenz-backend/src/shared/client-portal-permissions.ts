/**
 * Client Portal v2 roles and what each one can do.
 *
 * One role per client user, applied to every project the user is assigned to. This file is the
 * single source of truth: the client API middleware (`requireClientCapability`) enforces it and
 * `GET /portal/roles` serves it to Portal Settings, so the matrix an operator sees is the matrix
 * that is enforced.
 */
export const CLIENT_CONTACT_ROLES = ["admin", "member", "viewer"] as const;

export type ClientContactRole = (typeof CLIENT_CONTACT_ROLES)[number];

export function isClientContactRole(value: unknown): value is ClientContactRole {
  return typeof value === "string" && (CLIENT_CONTACT_ROLES as readonly string[]).includes(value);
}

export const CLIENT_CAPABILITIES = [
  "view",
  "comment",
  "upload",
  "submit_change_request",
  "approve",
  "manage_users",
] as const;

export type ClientCapability = (typeof CLIENT_CAPABILITIES)[number];

export interface ClientRoleDefinition {
  role: ClientContactRole;
  label: string;
  description: string;
  can: Record<ClientCapability, boolean>;
}

export const CLIENT_ROLE_DEFINITIONS: ClientRoleDefinition[] = [
  {
    role: "admin",
    label: "Client Admin",
    description:
      "Views assigned projects, comments, uploads permitted files, submits change requests, approves items and can manage client users if enabled.",
    can: {
      view: true,
      comment: true,
      upload: true,
      submit_change_request: true,
      approve: true,
      manage_users: true,
    },
  },
  {
    role: "member",
    label: "Client Member",
    description:
      "Views assigned projects, comments, uploads permitted files and submits change requests. Cannot approve or manage users.",
    can: {
      view: true,
      comment: true,
      upload: true,
      submit_change_request: true,
      approve: false,
      manage_users: false,
    },
  },
  {
    role: "viewer",
    label: "Client Viewer",
    description:
      "Read-only: project information, milestones, client-visible tasks and files. Cannot comment, upload, approve or submit change requests.",
    can: {
      view: true,
      comment: false,
      upload: false,
      submit_change_request: false,
      approve: false,
      manage_users: false,
    },
  },
];

/** Whether a role holds a capability. An unknown role holds nothing. */
export function clientRoleCan(role: string | null | undefined, capability: ClientCapability): boolean {
  const definition = CLIENT_ROLE_DEFINITIONS.find(item => item.role === role);
  return definition?.can[capability] === true;
}

/**
 * Permission levels from v1 (view / comment / contributor).
 *
 * Retired in v2: roles replace per-project levels. Kept only so the v1 company-user code that
 * still writes the nullable `client_contact_project_access.permission_level` keeps compiling until
 * those controllers are removed with the other retired modules.
 */
export const CLIENT_PERMISSION_LEVELS = ["view", "comment", "contributor"] as const;

export type ClientPermissionLevel = (typeof CLIENT_PERMISSION_LEVELS)[number];

export function isClientPermissionLevel(value: unknown): value is ClientPermissionLevel {
  return typeof value === "string" && (CLIENT_PERMISSION_LEVELS as readonly string[]).includes(value);
}
