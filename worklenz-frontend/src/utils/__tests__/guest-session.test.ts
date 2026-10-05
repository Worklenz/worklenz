import { describe, expect, it } from 'vitest';
import { getDefaultAuthenticatedPath, isSessionGuest } from '../guest-session';

describe('guest-session utils', () => {
  it('treats is_guest users as guests', () => {
    expect(isSessionGuest({ is_guest: true })).toBe(true);
  });

  it('never treats owners or admins as guests', () => {
    expect(isSessionGuest({ is_guest: true, owner: true })).toBe(false);
    expect(isSessionGuest({ is_guest: true, is_admin: true })).toBe(false);
  });

  it('routes guests to projects and members to home', () => {
    expect(getDefaultAuthenticatedPath({ is_guest: true })).toBe('/worklenz/projects');
    expect(getDefaultAuthenticatedPath({ is_guest: false })).toBe('/worklenz/home');
    expect(getDefaultAuthenticatedPath(null)).toBe('/worklenz/home');
  });
});
