import { Col, ConfigProvider, Layout, theme, Modal } from '@/shared/antd-imports';
import { useEffect, useState, useMemo } from 'react';
import Navbar from '@/features/navbar/navbar';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import ReportingSider from '../pages/reporting/sidebar/reporting-sider';
import { Outlet } from 'react-router-dom';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { setCurrentOrganization } from '@/features/reporting/reporting.slice';
import { toggleUpgradeModal, fetchOrganizationDetails } from '@/features/admin-center/admin-center.slice';
import { useAuthService } from '../hooks/useAuth';
import UpgradePlans from '@/components/admin-center/billing/drawers/upgrade-plans/UpgradePlans';
import logger from '@/utils/errorLogger';

const ReportingLayout = () => {
  const dispatch = useAppDispatch();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const { token } = theme.useToken();

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { isUpgradeModalOpen, billingInfo } = useAppSelector(state => state.adminCenterReducer);
  const currentSession = useAuthService().getCurrentSession();

  // Get browser timezone for upgrade plans
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Determine if user is AppSumo user for modal width
  const isAppSumoUser = useMemo(() => {
    const planName = billingInfo?.plan_name?.toLowerCase() || '';
    const subscriptionType = currentSession?.subscription_type?.toLowerCase() || '';
    const subscriptionStatus = currentSession?.subscription_status?.toLowerCase() || '';
    const billingSubscriptionType = billingInfo?.subscription_type?.toLowerCase() || '';

    // Check if user has AppSumo/Lifetime subscription in any of their subscription data
    return (
      planName.includes('appsumo') ||
      planName.includes('life_time_deal') ||
      planName.includes('lifetime') ||
      planName.includes('life time') ||
      subscriptionType.includes('appsumo') ||
      subscriptionType.includes('life_time_deal') ||
      subscriptionStatus.includes('life_time_deal') ||
      subscriptionStatus.includes('lifetime') ||
      subscriptionStatus.includes('life time') ||
      billingSubscriptionType.includes('appsumo') ||
      billingSubscriptionType.includes('life_time_deal') ||
      billingSubscriptionType.includes('lifetime') ||
      billingSubscriptionType.includes('life time')
    );
  }, [billingInfo, currentSession]);

  const fetchCurrentOrganization = async () => {
    try {
      const response = await reportingApiService.getInfo();
      if (response.done) {
        dispatch(setCurrentOrganization(response.body?.organization_name));
      }
    } catch (error) {
      logger.error('Error fetching current organization', error);
    }
  };

  useEffect(() => {
    fetchCurrentOrganization();
    // Fetch organization details for upgrade modal
    dispatch(fetchOrganizationDetails());
  }, [dispatch]);

  return (
    <ConfigProvider wave={{ disabled: true }}>
      <Layout style={{ minHeight: '100vh' }}>
        <Layout.Header
          className={`shadow-md ${themeMode === 'dark' ? 'shadow-[#5f5f5f1f]' : 'shadow-[#18181811]'}`}
          style={{
            zIndex: 999,
            position: 'fixed',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            padding: 0,
          }}
        >
          <Navbar />
        </Layout.Header>

        <Layout style={{ marginTop: 64 }}>
          <Layout.Sider
            trigger={null}
            collapsible
            collapsed={isCollapsed}
            collapsedWidth={80}
            width={240}
            style={{
              borderRight: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorBgContainer,
              position: 'fixed',
              height: 'calc(100vh - 64px)',
              left: 0,
              top: 64,
              zIndex: 100,
              overflow: 'auto',
            }}
          >
            <ReportingSider
              collapsed={isCollapsed}
              onToggleCollapse={() => setIsCollapsed(prev => !prev)}
            />
          </Layout.Sider>

          <Layout
            style={{
              marginLeft: isCollapsed ? 80 : 240,
              transition: 'margin-left 0.2s cubic-bezier(0.645, 0.045, 0.355, 1)',
            }}
          >
            <Layout.Content style={{ padding: 32, minHeight: 'calc(100vh - 64px)' }}>
              <Outlet />
            </Layout.Content>
          </Layout>
        </Layout>
      </Layout>

      {/* Global Upgrade Modal */}
      <Modal
        open={isUpgradeModalOpen}
        onCancel={() => dispatch(toggleUpgradeModal())}
        width={isAppSumoUser ? 700 : 1400}
        centered
        okButtonProps={{ hidden: true }}
        cancelButtonProps={{ hidden: true }}
        style={{ zIndex: 1000 }}
        destroyOnHidden
        maskClosable={false}
      >
        <div style={{ padding: '20px' }}>
          {/* LKR pricing disabled for now - always show main upgrade plans */}
          <UpgradePlans />
          {/* {browserTimeZone === 'Asia/Colombo' ? <UpgradePlansLKR /> : <UpgradePlans />} */}
        </div>
      </Modal>
    </ConfigProvider>
  );
};

export default ReportingLayout;
