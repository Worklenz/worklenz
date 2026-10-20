// TEST ONLY. A pretend signed-in session for the fake API, so the app opens without the OTP flow.
import type { ClientUser } from '@/types';
import { USERS } from './fixtures';
import { getScenario } from './scenario';

export interface MockSession {
  user: ClientUser;
  token: string;
  tokenExpiry: string;
}

export const mockSession = (): MockSession => {
  const scenario = getScenario();
  const person = USERS.find(u => u.id === scenario.userId) ?? USERS[0];
  return {
    token: 'mock-client-token',
    tokenExpiry: new Date(Date.now() + 365 * 86_400_000).toISOString(),
    user: {
      id: person.id,
      email: person.email,
      name: person.name,
      organizationId: scenario.teamId,
      permissions: [],
      role: person.role,
    },
  };
};
