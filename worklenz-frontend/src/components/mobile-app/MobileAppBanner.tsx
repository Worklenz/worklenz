import { useState, useCallback } from 'react';
import { Alert, Button, Space } from '@/shared/antd-imports';
import { CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuthService } from '@/hooks/useAuth';
import { profileSettingsApiService } from '@/api/settings/profile/profile-settings.api.service';
import { setSession } from '@/utils/session-helper';
import MobileAppModal from './MobileAppModal';

export const MobileAppBanner = () => {
  const { t } = useTranslation('settings/mobile-app');
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();

  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const persistDismissal = useCallback(async () => {
    try {
      await profileSettingsApiService.dismissMobileAppBanner();
      if (currentSession) {
        setSession({ ...currentSession, mobile_app_banner_dismissed: true });
      }
    } catch {
      // silently ignore — dismissal is best-effort
    }
  }, [currentSession]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    void persistDismissal();
  }, [persistDismissal]);

  const handleViewQRCodes = useCallback(() => {
    setModalOpen(true);
    void persistDismissal();
  }, [persistDismissal]);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setDismissed(true);
  }, []);

  if (dismissed || currentSession?.mobile_app_banner_dismissed) {
    return null;
  }

  return (
    <>
      <div
        style={{
          width: '100%',
          padding: '6px 48px',
          borderBottom: '1px solid rgba(24, 144, 255, 0.2)',
          background: 'rgba(24, 144, 255, 0.06)',
        }}
      >
        <Alert
          message={
            <Space size="middle" style={{ width: '100%', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 500 }}>{t('bannerText')}</span>
              <Space>
                <Button type="link" size="small" onClick={handleViewQRCodes} style={{ padding: 0 }}>
                  {t('bannerCta')}
                </Button>
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={handleDismiss}
                  style={{ color: '#595959' }}
                  aria-label={t('bannerDismiss')}
                />
              </Space>
            </Space>
          }
          type="info"
          showIcon={false}
          closable={false}
          style={{ border: 'none', background: 'transparent', padding: '2px 0' }}
        />
      </div>

      <MobileAppModal open={modalOpen} onClose={handleModalClose} />
    </>
  );
};
