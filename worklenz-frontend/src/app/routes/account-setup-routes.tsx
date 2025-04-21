import { RouteObject } from 'react-router-dom';
import AccountSetup from '@/pages/account-setup/account-setup';

const accountSetupRoute: RouteObject = {
  path: '/worklenz/setup',
  element: <AccountSetup />,
};

export default accountSetupRoute;
