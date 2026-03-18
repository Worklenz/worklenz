import React, { lazy, Suspense } from 'react';
import { RouteObject } from 'react-router-dom';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import ChunkErrorHandler from '@/utils/chunk-error-handler';

const NotFoundPage = lazy(
  ChunkErrorHandler.wrapLazyImport(() => import('@/pages/404-page/404-page'), 'NotFoundPage')
);

const notFoundRoute: RouteObject = {
  path: '*',
  element: (
    <Suspense fallback={<SuspenseFallback />}>
      <NotFoundPage />
    </Suspense>
  ),
};

export default notFoundRoute;
