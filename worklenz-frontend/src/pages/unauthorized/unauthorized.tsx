import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { Button, Result } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const Unauthorized = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('unauthorized');
  useDocumentTitle('Unauthorized');

  return (
    <div style={{ marginBlock: 65, minHeight: '90vh' }}>
      <Result
        status="warning"
        title={t('title')}
        subTitle={t('subtitle')}
        extra={
          <Button type="primary" key="console" onClick={() => navigate('/worklenz/home')}>
            {t('button')}
          </Button>
        }
      />
    </div>
  );
};

export default Unauthorized;
