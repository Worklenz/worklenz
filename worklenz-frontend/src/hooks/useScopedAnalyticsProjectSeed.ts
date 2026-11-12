import { useMemo } from 'react';

/** Keep the last seeded team selection separate for each active report scope. */
export const useScopedAnalyticsProjectSeed = (scope: string) =>
  useMemo(() => ({ current: '' }), [scope]);
