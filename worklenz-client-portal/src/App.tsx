import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ConfigProvider, theme } from '@/shared/antd-imports';
import { store } from '@/store';
import { useAppSelector } from '@/hooks/useAppSelector';
import { socketManager } from '@/utils/socket';

// Layout Components
import ClientLayout from '@/components/layout/ClientLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import PublicRoute from '@/components/PublicRoute';
import AuthProvider from '@/components/AuthProvider';

// Page Components
import LoginPage from '@/pages/LoginPage';
import InvitePage from '@/pages/InvitePage';
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
import ChatsPage from '@/pages/ChatsPage';
import ChatDetailsPage from '@/pages/ChatDetailsPage';
import SettingsPage from '@/pages/SettingsPage';
import ProfilePage from '@/pages/ProfilePage';



// App Content Component
const AppContent: React.FC = () => {
  const { theme: currentTheme } = useAppSelector((state) => state.ui);
  
  // Initialize socket connection
  React.useEffect(() => {
    const token = localStorage.getItem('clientToken');
    if (token) {
      // Socket manager is already initialized as singleton
      // Additional setup if needed can be done here
      console.log('Client portal app loaded with socket connection');
    }
    
    // Cleanup on unmount
    return () => {
      socketManager.disconnect();
    };
  }, []);

  return (
    <ConfigProvider
      theme={{
        algorithm: currentTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
          colorBgLayout: currentTheme === 'dark' ? '#141414' : '#f0f2f5',
          colorBgContainer: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
          colorText: currentTheme === 'dark' ? '#ffffff' : '#000000',
          colorTextSecondary: currentTheme === 'dark' ? '#a6a6a6' : '#666666',
          colorBorder: currentTheme === 'dark' ? '#303030' : '#d9d9d9',
        },
        components: {
          Layout: {
            siderBg: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
            headerBg: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
          },
          Menu: {
            colorBgContainer: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
            itemBg: 'transparent',
            itemSelectedBg: currentTheme === 'dark' ? '#1890ff20' : '#1890ff10',
            itemHoverBg: currentTheme === 'dark' ? '#ffffff10' : '#00000008',
            colorText: currentTheme === 'dark' ? '#ffffff' : '#000000',
            colorTextDescription: currentTheme === 'dark' ? '#a6a6a6' : '#666666',
          },
          Button: {
            borderRadius: 6,
          },
          Select: {
            borderRadius: 6,
          },
        },
      }}
    >
      <AuthProvider>
        <Router>
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
            <Route path="chats" element={<ChatsPage />} />
            <Route path="chats/:id" element={<ChatDetailsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/auth/login" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ConfigProvider>
  );
};

// Main App Component
const App: React.FC = () => {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
};

export default App;
