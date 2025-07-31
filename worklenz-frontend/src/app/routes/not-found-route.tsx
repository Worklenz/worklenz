import React, { lazy, Suspense } from 'react';
import { RouteObject } from 'react-router-dom';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';

const NotFoundPage = lazy(() => import('@/pages/404-page/404-page'));

const notFoundRoute: RouteObject = {
  path: '*',
  element: (
    <Suspense fallback={<SuspenseFallback />}>
      <NotFoundPage />
    </Suspense>
  ),
};

export default notFoundRoute;
