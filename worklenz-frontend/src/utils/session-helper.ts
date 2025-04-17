import { ILocalSession } from '@/types/auth/local-session.types';

export const WORKLENZ_SESSION_ID = import.meta.env.VITE_WORKLENZ_SESSION_ID;
const storage: Storage = localStorage;

export function setSession(user: ILocalSession): void {
  storage.setItem(WORKLENZ_SESSION_ID, btoa(unescape(encodeURIComponent(JSON.stringify(user)))));
  // storage.setItem(WORKLENZ_SESSION_ID, btoa(JSON.stringify(user)));
}

export function getUserSession(): ILocalSession | null {
  try {
    return JSON.parse(atob(<string>storage.getItem(WORKLENZ_SESSION_ID)));
  } catch (e) {
    return null;
  }
}

export function hasSession() {
  return !!storage.getItem(WORKLENZ_SESSION_ID);
}

export function deleteSession() {
  storage.removeItem(WORKLENZ_SESSION_ID);
}

export function getRole() {
  const session = getUserSession();
  if (!session) return 'Unknown';
  if (session.owner) return 'Owner';
  if (session.is_admin) return 'Admin';
  return 'Member';
}
