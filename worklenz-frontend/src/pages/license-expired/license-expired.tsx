import { Button, Result } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthService } from '@/hooks/useAuth';

// Simple license expired page that doesn't trigger verification
const LicenseExpired = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('license-expired');
  const authService = useAuthService();

  // Direct fallback content in case of translation issues
  const fallbackTitle = 'Your Worklenz trial has expired!';
  const fallbackSubtitle = 'Please upgrade now.';
  const fallbackButton = 'Upgrade now';

  return (
    <div
      style={{
        marginBlock: 65,
        minHeight: '90vh',
        padding: '20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Result
        status="warning"
        title={t('title') || fallbackTitle}
        subTitle={t('subtitle') || fallbackSubtitle}
        style={{ padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
        extra={
          <Button
            type="primary"
            key="console"
            size="large"
            onClick={() => navigate('/worklenz/admin-center/billing')}
          >
            {t('button') || fallbackButton}
          </Button>
        }
      />
    </div>
  );
};

export default LicenseExpired;
