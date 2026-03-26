export type NavRoutesType = {
  name: string;
  path: string;
  adminOnly: boolean;
  freePlanFeature?: boolean;
};

export const navRoutes: NavRoutesType[] = [
  {
    name: 'home',
    path: '/taskflow/home',
    adminOnly: false,
    freePlanFeature: true,
  },
  {
    name: 'projects',
    path: '/taskflow/projects',
    adminOnly: false,
    freePlanFeature: true,
  },
  // {
  //   name: 'schedule',
  //   path: '/taskflow/schedule',
  //   adminOnly: true,
  //   freePlanFeature: false,
  // },
  {
    name: 'reporting',
    path: '/taskflow/reporting/overview',
    adminOnly: true,
    freePlanFeature: false,
  },
];
