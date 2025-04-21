import { RouteObject } from 'react-router-dom';
import ReportingLayout from '@/layouts/ReportingLayout';
import { ReportingMenuItems, reportingsItems } from '@/lib/reporting/reporting-constants';

//  function to flatten nested menu items
const flattenItems = (items: ReportingMenuItems[]): ReportingMenuItems[] => {
  return items.reduce<ReportingMenuItems[]>((acc, item) => {
    if (item.children) {
      return [...acc, ...flattenItems(item.children)];
    }
    return [...acc, item];
  }, []);
};

const flattenedItems = flattenItems(reportingsItems);

const reportingRoutes: RouteObject[] = [
  {
    path: 'worklenz/reporting',
    element: <ReportingLayout />,
    children: flattenedItems.map(item => ({
      path: item.endpoint,
      element: item.element,
    })),
  },
];

export default reportingRoutes;
