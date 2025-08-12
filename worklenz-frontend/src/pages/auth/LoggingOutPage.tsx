import { useEffect } from 'react';
import { Card, Flex, Spin, Typography } from 'antd/es';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthService } from '@/hooks/useAuth';
import { useMediaQuery } from 'react-responsive';
import { authApiService } from '@/api/auth/auth.api.service';
import CacheCleanup from '@/utils/cache-cleanup';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_common_logout } from '@/shared/worklenz-analytics-events';

const LoggingOutPage = () => {
  const navigate = useNavigate();
  const auth = useAuthService();
  const { t } = useTranslation('auth/auth-common');
  const isMobile = useMediaQuery({ query: '(max-width: 576px)' });
  const { reset, trackMixpanelEvent } = useMixpanelTracking();

  useEffect(() => {
    const logout = async () => {
      try {
        // Track logout event
        trackMixpanelEvent(evt_common_logout);
        
        // Reset Mixpanel identity
        reset();
        
        // Clear local session
        await auth.signOut();
        
        // Call backend logout
        await authApiService.logout();
        
        // Clear all caches using the utility
        await CacheCleanup.clearAllCaches();
        
        // Force a hard reload to ensure fresh state
        setTimeout(() => {
          CacheCleanup.forceReload('/auth/login');
        }, 1000);
        
      } catch (error) {
        console.error('Logout error:', error);
        // Fallback: force reload to login page
        CacheCleanup.forceReload('/auth/login');
      }
    };
    
    void logout();
  }, [auth]);

  const cardStyles = {
    width: '100%',
    boxShadow: 'none',
  };

  return (
    <Card style={cardStyles}>
      <Flex vertical align="center" justify="center" gap="middle">
        <Spin size="large" />
        <Typography.Title level={3}>{t('loggingOut')}</Typography.Title>
      </Flex>
    </Card>
  );
};

export default LoggingOutPage;
