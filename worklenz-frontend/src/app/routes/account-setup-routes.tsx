import { RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import ChunkErrorHandler from '@/utils/chunk-error-handler';
const AccountSetup = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/account-setup/account-setup'),
    'AccountSetup'
  )
);

const accountSetupRoute: RouteObject = {
  path: '/worklenz/setup',
  element: (
    <Suspense fallback={<SuspenseFallback />}>
      <AccountSetup />
    </Suspense>
  ),
};

export default accountSetupRoute;
