import {ILocalSession} from "@interfaces/api-models/local-session";

export const WORKLENZ_SESSION_ID = "worklenz.sid";
const storage: Storage = localStorage;

export function setSession(user: ILocalSession): void {
  storage.setItem(WORKLENZ_SESSION_ID, btoa(unescape(encodeURIComponent(JSON.stringify(user)))));
  // storage.setItem(WORKLENZ_SESSION_ID, btoa(JSON.stringify(user)));
}

export function getSession(): ILocalSession | null {
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
