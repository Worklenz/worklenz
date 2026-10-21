import { Button, Flex, Typography } from '@/shared/antd-imports';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate } from 'react-router-dom';
import { InvoicesTable } from './Invoices-table/invoices-table';
import './invoices.css';

const { Title } = Typography;

const ClientPortalInvoices = () => {
  // localization
  const { t } = useTranslation('client-portal-invoices');
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
            {t('title', { defaultValue: 'Invoices' })}
          </Title>
          <Typography.Text type="secondary">
            {t('description', { defaultValue: 'Send, track, and collect client payments' })}
          </Typography.Text>
        </div>

        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => navigate('/worklenz/client-portal/invoices/create')}
        >
          {t('createInvoiceButton', { defaultValue: 'Create Invoice' })}
        </Button>
      </Flex>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <InvoicesTable />
      </div>

      {/* invoices/create, invoices/:id and invoices/:id/edit render here as modals over the
          list, so a direct or shared link still shows the list underneath. */}
      <Outlet />
    </div>
  );
};

export default ClientPortalInvoices;
