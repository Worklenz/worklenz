import { Card, Flex, Typography, QRCode } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { RootState } from '@/app/store';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import {
  WORKLENZ_APP_STORE_URL,
  WORKLENZ_GOOGLE_PLAY_URL,
} from '@/shared/mobile-app-constants';

const MobileAppSettings = () => {
  const { t } = useTranslation('settings/mobile-app');
  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);
  const isDark = themeMode === 'dark';

  useDocumentTitle(t('pageTitle'));

  return (
    <Card style={{ width: '100%' }}>
      <Flex vertical gap={24}>
        <Flex vertical gap={4}>
          <Typography.Title level={4} style={{ marginBlockEnd: 0 }}>
            {t('pageTitle')}
          </Typography.Title>
          <Typography.Text type="secondary">{t('pageDescription')}</Typography.Text>
        </Flex>

        <Flex gap={40} wrap justify="flex-start">
          {/* App Store */}
          <Flex vertical align="center" gap={12}>
            <QRCode
              value={WORKLENZ_APP_STORE_URL}
              size={160}
              color={isDark ? '#ffffff' : '#000000'}
              bgColor={isDark ? '#1f1f1f' : '#ffffff'}
            />
            <Typography.Text strong>{t('appStoreLabel')}</Typography.Text>
            <a href={WORKLENZ_APP_STORE_URL} target="_blank" rel="noopener noreferrer">
              <img
                src="/img/app-store-badge.svg"
                alt={t('appStoreBadgeAlt')}
                style={{ height: 40 }}
                onError={e => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </a>
          </Flex>

          {/* Google Play */}
          <Flex vertical align="center" gap={12}>
            <QRCode
              value={WORKLENZ_GOOGLE_PLAY_URL}
              size={160}
              color={isDark ? '#ffffff' : '#000000'}
              bgColor={isDark ? '#1f1f1f' : '#ffffff'}
            />
            <Typography.Text strong>{t('googlePlayLabel')}</Typography.Text>
            <a href={WORKLENZ_GOOGLE_PLAY_URL} target="_blank" rel="noopener noreferrer">
              <img
                src="/img/google-play-badge.png"
                alt={t('googlePlayBadgeAlt')}
                style={{ height: 40 }}
                onError={e => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </a>
          </Flex>
        </Flex>
      </Flex>
    </Card>
  );
};

export default MobileAppSettings;
