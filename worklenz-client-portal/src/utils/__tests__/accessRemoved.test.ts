import { describe, expect, it, vi } from 'vitest';
import {
  ACCESS_REMOVED_EVENT,
  accessRemovedPath,
  getAccessRemovedReason,
  isAccessRemovedResponse,
  isAccessRevokedBody,
  signalAccessRemoved,
} from '../accessRemoved';

const revoked = (reason?: string) => ({ message: 'x', body: { code: 'ACCESS_REVOKED', reason } });

describe('access removed helpers', () => {
  it('reads the machine-readable code and only the four known reasons', () => {
    expect(isAccessRevokedBody(revoked())).toBe(true);
    expect(isAccessRevokedBody({ body: { code: 'OTHER' } })).toBe(false);
    expect(getAccessRemovedReason(revoked('account_deleted'))).toBe('account_deleted');
    expect(getAccessRemovedReason(revoked('<script>'))).toBeNull();
    expect(getAccessRemovedReason(undefined)).toBeNull();
  });

  it('treats a 404 as an unavailable item, never as removed access', () => {
    expect(isAccessRemovedResponse(404, revoked())).toBe(false);
    expect(isAccessRemovedResponse(403, revoked('access_removed'))).toBe(true);
    expect(isAccessRemovedResponse(401, null)).toBe(true);
  });

  it('builds the screen address from a reason', () => {
    expect(accessRemovedPath('organization_unavailable')).toBe('/access-removed?reason=organization_unavailable');
    expect(accessRemovedPath(null)).toBe('/access-removed');
  });

  it('clears the session and announces the reason', () => {
    localStorage.setItem('clientToken', 't');
    const listener = vi.fn();
    window.addEventListener(ACCESS_REMOVED_EVENT, listener);
    signalAccessRemoved('access_disabled');
    window.removeEventListener(ACCESS_REMOVED_EVENT, listener);
    expect(localStorage.getItem('clientToken')).toBeNull();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ reason: 'access_disabled' });
  });
});
