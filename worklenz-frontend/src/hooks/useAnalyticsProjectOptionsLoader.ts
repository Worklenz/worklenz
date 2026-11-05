import { useEffect, useRef } from 'react';

/** Run a project-options load only while its report, session, and teams remain current. */
export const useAnalyticsProjectOptionsLoader = (
  teamIds: string[],
  scope: string,
  load: (teamIds: string[], isCurrent: () => boolean) => Promise<void>
): void => {
  const latest = useRef({ teamIds, scope });
  latest.current = { teamIds, scope };

  useEffect(() => {
    let isActive = true;
    const isCurrent = () => isActive && latest.current.teamIds === teamIds && latest.current.scope === scope;
    void load(teamIds, isCurrent);
    return () => { isActive = false; };
  }, [teamIds, scope, load]);
};

/** A partial team response must not be used to reconcile saved selections. */
export const areAnalyticsProjectResponsesComplete = (
  responses: ReadonlyArray<{ done: boolean; body: unknown }>
): boolean => responses.every(response => response.done && Array.isArray(response.body));
