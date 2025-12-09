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
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          colorBgLayout: currentTheme === 'dark' ? '#141414' : '#f5f5f5',
          colorBgContainer: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
          colorText: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.88)',
          colorTextSecondary: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
          colorBorder: currentTheme === 'dark' ? '#424242' : '#d9d9d9',
          colorBorderSecondary: currentTheme === 'dark' ? '#303030' : '#f0f0f0',
          colorFillSecondary: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
          colorFillTertiary: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
        },
        components: {
          Layout: {
            siderBg: currentTheme === 'dark' ? '#141414' : '#ffffff',
            headerBg: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
            bodyBg: currentTheme === 'dark' ? '#141414' : '#f5f5f5',
          },
          Menu: {
            colorBgContainer: 'transparent',
            itemBg: 'transparent',
            itemSelectedBg: currentTheme === 'dark' ? 'rgba(24, 144, 255, 0.15)' : '#e6f4ff',
            itemHoverBg: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
            itemSelectedColor: '#1890ff',
            itemColor: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.88)',
            itemMarginBlock: 4,
            itemMarginInline: 8,
            itemPaddingInline: 16,
            itemBorderRadius: 6,
          },
          Card: {
            borderRadiusLG: 8,
            paddingLG: 24,
          },
          Button: {
            borderRadius: 6,
            controlHeight: 36,
          },
          Input: {
            borderRadius: 6,
            controlHeight: 36,
          },
          Select: {
            borderRadius: 6,
            controlHeight: 36,
          },
          Table: {
            borderRadius: 8,
            headerBg: currentTheme === 'dark' ? '#1f1f1f' : '#fafafa',
          },
          Statistic: {
            contentFontSize: 28,
          },
          Typography: {
            titleMarginBottom: 0,
            titleMarginTop: 0,
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
