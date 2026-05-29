import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layout Components
import ClientLayout from '@/components/layout/ClientLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import PublicRoute from '@/components/PublicRoute';

// Page Components
import LoginPage from '@/pages/LoginPage';
import InvitePage from '@/pages/InvitePage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import DashboardPage from '@/pages/DashboardPage';
import ServicesPage from '@/pages/ServicesPage';
import ServiceDetailsPage from '@/pages/ServiceDetailsPage';
import RequestsPage from '@/pages/RequestsPage';
import NewRequestPage from '@/pages/NewRequestPage';
import RequestDetailsPage from '@/pages/RequestDetailsPage';
import ProjectsPage from '@/pages/ProjectsPage';
import ProjectDetailsPage from '@/pages/ProjectDetailsPage';
import InvoicesPage from '@/pages/InvoicesPage';
import InvoiceDetailsPage from '@/pages/InvoiceDetailsPage';
import EditInvoicePage from '@/pages/EditInvoicePage';
import ChatsPage from '@/pages/ChatsPage';
import ChatDetailsPage from '@/pages/ChatDetailsPage';
import SettingsPage from '@/pages/SettingsPage';
import ProfilePage from '@/pages/ProfilePage';

export const AppRoutes: React.FC = () => (
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
);


