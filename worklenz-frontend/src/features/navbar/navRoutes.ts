export type NavRoutesType = {
  name: string;
  path: string;
  adminOnly: boolean;
  freePlanFeature?: boolean;
  selfHostedExcluded?: boolean;
  teamLeadOnly?: boolean;
  guestExcluded?: boolean; // Hide for guest-only users
};

// Shared by desktop (navbar.tsx) and mobile (MobileMenuButton.tsx) so both
// surfaces gate the exact same routes for free-plan users instead of each
// re-deriving the rule independently.
export const isRouteGatedForFreePlan = (route: NavRoutesType, isFreePlan: boolean): boolean =>
  !route.freePlanFeature && isFreePlan;

export const navRoutes: NavRoutesType[] = [
  {
    name: 'home',
    path: '/worklenz/home',
    adminOnly: false,
    freePlanFeature: true,
    guestExcluded: true, // Hide Home for guest-only users
  },
  {
    name: 'projects',
    path: '/worklenz/projects',
    adminOnly: false,
    freePlanFeature: true,
  },
  {
    name: 'planner',
    path: '/worklenz/planner',
    adminOnly: true,
    freePlanFeature: false,
  },
  {
    name: 'client-portal',
    // Bare surface root — resolves to whichever item is pinned as default
    // (or 'clients' if nothing is pinned) via the client-portal index route.
    path: '/worklenz/client-portal',
    adminOnly: true,
    freePlanFeature: false,
    selfHostedExcluded: true,
  },
  {
    name: 'finance',
    path: '/worklenz/finance',
    adminOnly: true,
    freePlanFeature: false,
  },
  {
    name: 'reporting',
    // Bare surface root — resolves to whichever item is pinned as default
    // (or 'overview' if nothing is pinned) via the reporting index route.
    path: '/worklenz/reporting',
    adminOnly: true,
    freePlanFeature: false,
  },
  {
    name: 'Team Reports',
    path: '/worklenz/team-lead-reports',
    adminOnly: false,
    freePlanFeature: true,
    teamLeadOnly: true,
  },
];
