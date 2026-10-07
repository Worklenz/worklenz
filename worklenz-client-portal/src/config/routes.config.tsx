import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from '@/shared/antd-imports';

// Layout Components
import ClientLayout from '@/components/layout/ClientLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import PublicRoute from '@/components/PublicRoute';

// Page Components
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const InvitePage = lazy(() => import('@/pages/InvitePage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ServicesPage = lazy(() => import('@/pages/ServicesPage'));
const ServiceDetailsPage = lazy(() => import('@/pages/ServiceDetailsPage'));
const RequestsPage = lazy(() => import('@/pages/RequestsPage'));
const NewRequestPage = lazy(() => import('@/pages/NewRequestPage'));
const RequestDetailsPage = lazy(() => import('@/pages/RequestDetailsPage'));
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage'));
const ProjectDetailsPage = lazy(() => import('@/pages/ProjectDetailsPage'));
const InvoicesPage = lazy(() => import('@/pages/InvoicesPage'));
const InvoiceDetailsPage = lazy(() => import('@/pages/InvoiceDetailsPage'));
const EditInvoicePage = lazy(() => import('@/pages/EditInvoicePage'));
const ChatsPage = lazy(() => import('@/pages/ChatsPage'));
const ChatDetailsPage = lazy(() => import('@/pages/ChatDetailsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));

export const AppRoutes: React.FC = () => (
  <Suspense fallback={<Spin fullscreen />}>
    <Routes>
    {/* Public Routes */}
    <Route
      path="/auth/login"
      element={
        <PublicRoute restricted>
          <LoginPage />
        </PublicRoute>
      }
    />
    <Route path="/login" element={<Navigate to="/auth/login" replace />} />
    <Route
      path="/auth/forgot-password"
      element={
        <PublicRoute restricted>
          <ForgotPasswordPage />
        </PublicRoute>
      }
    />
    {/* Legacy redirect for old /forgot-password links */}
    <Route path="/forgot-password" element={<Navigate to="/auth/forgot-password" replace />} />
    <Route
      path="/auth/reset-password"
      element={
        <PublicRoute restricted>
          <ResetPasswordPage />
        </PublicRoute>
      }
    />
    <Route
      path="/invite"
      element={
        <PublicRoute restricted>
          <InvitePage />
        </PublicRoute>
      }
    />
    <Route
      path="/organization-invite"
      element={
        <PublicRoute restricted>
          <InvitePage />
        </PublicRoute>
      }
    />

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
      <Route path="services" element={<ServicesPage />} />
      <Route path="services/:id" element={<ServiceDetailsPage />} />
      <Route path="requests" element={<RequestsPage />} />
      <Route path="requests/new" element={<NewRequestPage />} />
      <Route path="requests/:id" element={<RequestDetailsPage />} />
      <Route path="projects" element={<ProjectsPage />} />
      <Route path="projects/:id" element={<ProjectDetailsPage />} />
      <Route path="invoices" element={<InvoicesPage />} />
      <Route path="invoices/:id" element={<InvoiceDetailsPage />} />
      <Route path="invoices/:id/edit" element={<EditInvoicePage />} />
      <Route path="chats" element={<ChatsPage />} />
      <Route path="chats/:id" element={<ChatDetailsPage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="profile" element={<ProfilePage />} />
    </Route>

    {/* Catch all route */}
    <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  </Suspense>
);


