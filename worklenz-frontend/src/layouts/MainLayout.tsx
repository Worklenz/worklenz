import { Layout, Modal } from '@/shared/antd-imports';
import { Outlet, useLocation } from 'react-router-dom';
import { memo, useMemo, useState, useEffect } from 'react';

import Navbar from '@/features/navbar/navbar';
// import BusinessPlanAnnouncement from '@/components/business-plan-announcement/BusinessPlanAnnouncement';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { TrialExpirationAlert } from '@/components/TrialExpirationAlert/TrialExpirationAlert';
import UpgradePlans from '@/components/admin-center/billing/drawers/upgrade-plans/UpgradePlans';
import UpgradePlansLKR from '@/components/admin-center/billing/drawers/upgrade-plans-lkr/upgrade-plans-lkr';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { useAuthService } from '../hooks/useAuth';
import { billingApiService } from '@/api/admin-center/billing.api.service';
import logger from '@/utils/errorLogger';
import { ImportProgressNotifier } from '@/components/imports/ImportProgressNotifier';

const MainLayout = memo(() => {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { isUpgradeModalOpen, billingInfo } = useAppSelector(state => state.adminCenterReducer);
  const currentSession = useAuthService().getCurrentSession();
  const location = useLocation();

  // State for LKR eligibility detection
  const [isLkrUser, setIsLkrUser] = useState<boolean>(false);
  const [regionCheckComplete, setRegionCheckComplete] = useState<boolean>(false);

  // Check user's region on mount using IP-based geolocation with timezone fallback
  // Uses localStorage caching to avoid repeated API calls (24-hour cache validity)
  useEffect(() => {
    const CACHE_KEY = 'worklenz_user_region_check';
    const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    const checkUserRegion = async () => {
      try {
        // Check if we have a valid cached result
        const cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedData) {
          try {
            const { isLkrUser: cachedIsLkrUser, timestamp } = JSON.parse(cachedData);
            const now = Date.now();
            
            // If cache is still valid (less than 24 hours old), use it
            if (now - timestamp < CACHE_DURATION) {
              setIsLkrUser(cachedIsLkrUser);
              setRegionCheckComplete(true);
              logger.info(`Using cached region data: LKR eligible = ${cachedIsLkrUser}`);
              return;
            }
            // Cache expired, continue to make API call
            logger.info('Region cache expired, fetching fresh data');
          } catch (parseError) {
            // Invalid cache data, continue to make API call
            logger.error('Failed to parse cached region data', parseError);
          }
        }

        // Make API call to check region
        const response = await billingApiService.checkRegion();
        
        if (response.done && response.body) {
          const { isLkrEligible, countryCode } = response.body;
          let finalIsLkrUser = false;
          
          // If IP detection succeeded (not null), use that result
          if (isLkrEligible !== null) {
            finalIsLkrUser = isLkrEligible;
            setIsLkrUser(isLkrEligible);
            logger.info(`Region detected via IP: ${countryCode} - LKR eligible: ${isLkrEligible}`);
          } else {
            // Fallback to timezone detection
            const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const isLkrByTimezone = browserTimeZone === 'Asia/Colombo';
            finalIsLkrUser = isLkrByTimezone;
            setIsLkrUser(isLkrByTimezone);
            logger.info(`Region detection fallback to timezone: ${browserTimeZone} - LKR eligible: ${isLkrByTimezone}`);
          }

          // Cache the result with timestamp
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            isLkrUser: finalIsLkrUser,
            timestamp: Date.now()
          }));
        } else {
          // API call failed, fallback to timezone
          const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const isLkrByTimezone = browserTimeZone === 'Asia/Colombo';
          setIsLkrUser(isLkrByTimezone);
          logger.error('Region check API failed, using timezone fallback');
          
          // Cache the fallback result
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            isLkrUser: isLkrByTimezone,
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        // On error, fallback to timezone detection
        const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const isLkrByTimezone = browserTimeZone === 'Asia/Colombo';
        setIsLkrUser(isLkrByTimezone);
        logger.error('Region check error, using timezone fallback', error);
        
        // Cache the fallback result
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            isLkrUser: isLkrByTimezone,
            timestamp: Date.now()
          }));
        } catch (storageError) {
          // Ignore localStorage errors (e.g., quota exceeded, private browsing)
          logger.error('Failed to cache region data', storageError);
        }
      } finally {
        setRegionCheckComplete(true);
      }
    };

    checkUserRegion();
  }, []);

  // Determine if user is AppSumo user for modal width
  const isAppSumoUser = useMemo(() => {
    const planName = billingInfo?.plan_name?.toLowerCase() || '';
    const subscriptionType = currentSession?.subscription_type?.toLowerCase() || '';
    const subscriptionStatus = currentSession?.subscription_status?.toLowerCase() || '';
    const billingSubscriptionType = billingInfo?.subscription_type?.toLowerCase() || '';

    // Check if user has AppSumo/Lifetime subscription in any of their subscription data
    // Note: Users on trial who were originally AppSumo users should still be considered AppSumo users
    // They get to see AppSumo pricing even during trial period
    // Important: subscription_status persists as "life_time_deal" even during trial!
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

  const isProjectView =
    (location.pathname.includes('/projects/') && !location.pathname.endsWith('/projects')) ||
    location.pathname.includes('/worklenz/schedule');

  const isProjectListView =
    location.pathname.includes('/projects') && location.search.includes('page=');

  return (
    <>
      <ImportProgressNotifier />
      <Layout className="min-h-screen">
        {/* Trial expiration alert banner */}
        <TrialExpirationAlert />
        {/* <BusinessPlanAnnouncement /> */}

        <Layout.Header
          className={`sticky top-0 z-[999] flex items-center p-0 shadow-md ${themeMode === 'dark' ? 'border-b border-[#303030]' : 'shadow-[#18181811]'
            }`}
        >
          <Navbar />
        </Layout.Header>

        <Layout.Content
          className={`px-4 sm:px-8 lg:px-12 xl:px-16 ${!isProjectView ? 'overflow-x-hidden max-w-[1400px]' : ''} ${isProjectListView ? 'overflow-x-hidden max-w-[1600px]' : ''} mx-auto w-full`}
        >
          <Outlet />
        </Layout.Content>
      </Layout>

      {/* Global Upgrade Modal */}
      <Modal
        open={isUpgradeModalOpen}
        onCancel={() => dispatch(toggleUpgradeModal())}
        width={isLkrUser ? 'fit-content' : isAppSumoUser ? 700 : 1400}
        centered
        okButtonProps={{ hidden: true }}
        cancelButtonProps={{ hidden: true }}
        style={{ zIndex: 1000 }}
        destroyOnHidden
        maskClosable={false}
      >
        <div style={{ padding: '20px' }}>
          {/* Show appropriate upgrade plans based on IP-detected region with timezone fallback */}
          {regionCheckComplete ? (
            isLkrUser ? <UpgradePlansLKR /> : <UpgradePlans />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
          )}
        </div>
      </Modal>
    </>
  );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;
