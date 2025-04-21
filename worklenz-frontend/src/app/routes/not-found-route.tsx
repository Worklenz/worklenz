import React from 'react';
import { RouteObject } from 'react-router-dom';
import NotFoundPage from '@/pages/404-page/404-page';

const notFoundRoute: RouteObject = {
  path: '*',
  element: <NotFoundPage />,
};

export default notFoundRoute;
