/**
 * Permission levels a client company user can hold on a project.
 *
 * The labels, descriptions and Permission Templates live in the frontend
 * (`lib/client-portal/client-permissions.ts`) and are defined once there. The backend only needs
 * the set of valid levels to validate input and back the table's CHECK constraint.
 */
export const CLIENT_PERMISSION_LEVELS = ["view", "comment", "contributor"] as const;

export type ClientPermissionLevel = (typeof CLIENT_PERMISSION_LEVELS)[number];

export function isClientPermissionLevel(value: unknown): value is ClientPermissionLevel {
  return typeof value === "string" && (CLIENT_PERMISSION_LEVELS as readonly string[]).includes(value);
}

export const CLIENT_CONTACT_ROLES = ["poc", "member"] as const;

export type ClientContactRole = (typeof CLIENT_CONTACT_ROLES)[number];

export function isClientContactRole(value: unknown): value is ClientContactRole {
  return typeof value === "string" && (CLIENT_CONTACT_ROLES as readonly string[]).includes(value);
}
