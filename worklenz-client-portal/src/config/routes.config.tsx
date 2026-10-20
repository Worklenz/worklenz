import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from '@/shared/antd-imports';

// Layout Components
import ClientLayout from '@/components/layout/ClientLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import PublicRoute from '@/components/PublicRoute';
import InviteRoute from '@/components/InviteRoute';
import { InvoicesGate } from '@/components/v2/InvoicesGate';

// Page Components
const SignInPage = lazy(() => import('@/pages/SignInPage'));
const AccessRemovedPage = lazy(() => import('@/pages/AccessRemovedPage'));
const DashboardPage = lazy(() => import('@/pages/v2/DashboardPage'));
const ProjectsPage = lazy(() => import('@/pages/v2/ProjectsPage'));
const ProjectWorkspacePage = lazy(() => import('@/pages/v2/ProjectWorkspacePage'));
const DiscussionsPage = lazy(() => import('@/pages/v2/DiscussionsPage'));
const ApprovalsPage = lazy(() => import('@/pages/v2/ApprovalsPage'));
const ChangeRequestsPage = lazy(() => import('@/pages/v2/ChangeRequestsPage'));
const NotificationsPage = lazy(() => import('@/pages/v2/NotificationsPage'));
const AccountPage = lazy(() => import('@/pages/v2/AccountPage'));
const SettingsPage = lazy(() => import('@/pages/v2/SettingsPage'));
const InvoicesPage = lazy(() => import('@/pages/InvoicesPage'));
const InvoiceDetailsPage = lazy(() => import('@/pages/InvoiceDetailsPage'));
const MovedPage = lazy(() => import('@/pages/MovedPage'));

export const AppRoutes: React.FC = () => (
  <Suspense fallback={<Spin fullscreen />}>
    <Routes>
    {/* Public Routes: sign-in is a one-time code sent to the address, from the page or from an emailed link */}
    <Route
      path="/auth/login"
      element={
        <PublicRoute restricted>
          <SignInPage />
        </PublicRoute>
      }
    />
    <Route path="/login" element={<Navigate to="/auth/login" replace />} />
    {/* The emailed invitation link: accepted directly when already signed in, the code sign-in otherwise. */}
    <Route path="/invite" element={<InviteRoute />} />
    {/* Shown after the server says this person's access was removed. */}
    <Route path="/access-removed" element={<AccessRemovedPage />} />
    {/* There are no passwords any more: old password and self-registration links land on the sign-in page. */}
    <Route path="/auth/forgot-password" element={<Navigate to="/auth/login" replace />} />
    <Route path="/forgot-password" element={<Navigate to="/auth/login" replace />} />
    <Route path="/auth/reset-password" element={<Navigate to="/auth/login" replace />} />
    <Route path="/organization-invite" element={<Navigate to="/auth/login" replace />} />

    {/* Protected Routes */}
    <Route
      path="/"
      element={
        <ProtectedRoute>
          <ClientLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="dashboard" element={<DashboardPage />} />
      <Route path="projects" element={<ProjectsPage />} />
      {/* Tabs: overview | milestones | tasks | files | discussions. An unknown tab opens Overview. */}
      <Route path="projects/:projectId/:tab?" element={<ProjectWorkspacePage />} />
      <Route path="discussions" element={<DiscussionsPage />} />
      <Route path="approvals/:id?" element={<ApprovalsPage />} />
      <Route path="change-requests/:id?" element={<ChangeRequestsPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="account/:tab?" element={<AccountPage />} />
      <Route path="settings/:section?" element={<SettingsPage />} />
      <Route
        path="invoices"
        element={
          <InvoicesGate>
            <InvoicesPage />
          </InvoicesGate>
        }
      />
      <Route
        path="invoices/:id"
        element={
          <InvoicesGate>
            <InvoiceDetailsPage />
          </InvoicesGate>
        }
      />
      {/* Retired in v2: old links land on a notice. */}
      <Route path="services/*" element={<MovedPage />} />
      <Route path="requests/*" element={<MovedPage />} />
      <Route path="chats/*" element={<MovedPage />} />
      <Route path="profile" element={<Navigate to="/settings/profile" replace />} />
    </Route>

    {/* Catch all route */}
    <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  </Suspense>
);
