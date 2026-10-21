// TEST ONLY. Scenario state stands in for everything that happens elsewhere: the operator's Portal Settings in
// the admin console, and the internal team's actions (unsharing an item, removing access).

export interface MockScenario {
  userId: string;
  /** The team (workspace) the user is acting in; follows the team switcher. */
  teamId: string;
  /** Whether the signed-in login also belongs to other teams (shows the team switcher). */
  multiTeam: boolean;
  invoicesVisible: boolean;
  /** Whether the operator set a Portal Title in Portal Settings > Branding (no logo is mocked either way). */
  brandingSet: boolean;
  adminsCanInvite: boolean;
  adminsCanRemove: boolean;
  emailedEventTypes: string[];
  /** Tasks/files/milestones staff turned Internal Only. */
  hiddenIds: string[];
  /** Per user: project ids staff removed. */
  removedProjects: Record<string, string[]>;
  revokedUserIds: string[];
}

const KEY = 'clientPortalMockScenario';

export const DEFAULT_SCENARIO: MockScenario = {
  userId: 'u-alex',
  teamId: 'org-brandbase',
  multiTeam: true,
  invoicesVisible: false,
  brandingSet: true,
  adminsCanInvite: false,
  adminsCanRemove: false,
  emailedEventTypes: ['Approval', 'Comment', 'Change Request', 'Access'],
  hiddenIds: [],
  removedProjects: {},
  revokedUserIds: [],
};

const read = (): MockScenario => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SCENARIO, ...JSON.parse(raw) } : { ...DEFAULT_SCENARIO };
  } catch {
    return { ...DEFAULT_SCENARIO };
  }
};

let scenario: MockScenario = read();
const listeners = new Set<() => void>();

export const getScenario = (): MockScenario => scenario;

export const setScenario = (patch: Partial<MockScenario>): void => {
  scenario = { ...scenario, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(scenario));
  } catch {
    // storage unavailable: keep the in-memory scenario
  }
  listeners.forEach(listener => listener());
};

export const resetScenario = (): void => setScenario({ ...DEFAULT_SCENARIO });

export const subscribeScenario = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
