import { Button, Flex, Typography } from '@/shared/antd-imports';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate } from 'react-router-dom';
import { QuotesTable } from './QuotesTable';
import '../invoices/invoices.css';

const { Title } = Typography;

const ClientPortalQuotes = () => {
  const { t } = useTranslation('client-portal-quotes');
  const navigate = useNavigate();

  return (
    <div
      className="invoices-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        maxWidth: '100%',
      }}
    >
      <Flex
        align="flex-start"
        justify="space-between"
        wrap="wrap"
        gap={12}
        style={{ marginBottom: 16, flexShrink: 0 }}
      >
        <div style={{ minWidth: 0 }}>
          <Title level={4} style={{ margin: 0, fontSize: 22 }}>
            {t('title', { defaultValue: 'Quotes' })}
          </Title>
          <Typography.Text type="secondary">
            {t('description', { defaultValue: 'Prepare, track, and follow up on client quotes' })}
          </Typography.Text>
        </div>

        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => navigate('/worklenz/client-portal/quotes/create')}
        >
          {t('createQuoteButton', { defaultValue: 'Create Quote' })}
        </Button>
      </Flex>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <QuotesTable />
      </div>

      {/* quotes/create and quotes/:id render here as modals over the list, so a direct or
          shared link still shows the list underneath. */}
      <Outlet />
    </div>
  );
};

export default ClientPortalQuotes;
