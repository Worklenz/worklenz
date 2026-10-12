import { describe, expect, it } from 'vitest';

import { canAccessTaskExport, hasTaskExportRoleAccess } from './task-export-access';

describe('hasTaskExportRoleAccess', () => {
  it('allows owner/admin, project manager, or team lead', () => {
    expect(hasTaskExportRoleAccess(false, false)).toBe(false);
    expect(hasTaskExportRoleAccess(true, false)).toBe(true);
    expect(hasTaskExportRoleAccess(false, true)).toBe(true);
    expect(hasTaskExportRoleAccess(false, false, true)).toBe(true);
  });
});

describe('canAccessTaskExport', () => {
  it('requires Business plan access in addition to role', () => {
    expect(canAccessTaskExport(true, false)).toBe(false);
    expect(canAccessTaskExport(false, true)).toBe(false);
    expect(canAccessTaskExport(false, false, true)).toBe(false);
    expect(canAccessTaskExport(false, false, false, true)).toBe(false);
    expect(canAccessTaskExport(true, false, false, true)).toBe(true);
    expect(canAccessTaskExport(false, true, false, true)).toBe(true);
    expect(canAccessTaskExport(false, false, true, true)).toBe(true);
  });
});
