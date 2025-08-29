import { Flex, Typography, Card } from '@/shared/antd-imports';
import Button from 'antd/lib/button';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, FileTextOutlined } from '@ant-design/icons';
import InvoicesTable from './Invoices-table/invoices-table';
import AddInvoiceDrawer from '../../../features/clients-portal/invoices/add-invoice-drawer';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { toggleAddInvoiceDrawer } from '../../../features/clients-portal/invoices/invoices-slice';
import { useResponsive } from '../../../hooks/useResponsive';

const ClientPortalInvoices = () => {
  // localization
  const { t } = useTranslation('client-portal-invoices');
  const { isDesktop } = useResponsive();
  const dispatch = useAppDispatch();

  // function to handle add invoices
  const handleAddInvoice = () => {
    dispatch(toggleAddInvoiceDrawer());
  };

  return (
    <div
      style={{
        maxWidth: '100%',
        minHeight: 'calc(100vh - 120px)',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: isDesktop ? 32 : 24 }}>
        <Flex align="center" justify="space-between" style={{ width: '100%' }} wrap="wrap" gap={16}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Flex align="center" gap={12} style={{ marginBottom: 8 }}>
              <FileTextOutlined style={{ fontSize: 20 }} />
              <Typography.Title
                level={4}
                style={{
                  margin: 0,
                  fontSize: '20px',
                }}
              >
                {t('title') || 'Invoices'}
              </Typography.Title>
            </Flex>
            <Typography.Text
              type="secondary"
              style={{
                fontSize: isDesktop ? '16px' : '14px',
                lineHeight: 1.5,
              }}
            >
              {t('description') || 'Manage and track your invoices'}
            </Typography.Text>
          </div>

          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddInvoice}>
            {t('addInvoiceButton') || 'Add Invoice'}
          </Button>
        </Flex>
      </div>

      {/* Invoices Table */}
      <Card
        style={{
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderRadius: 8,
        }}
      >
        <InvoicesTable />
      </Card>

      {/* drawers  */}
      <AddInvoiceDrawer />
    </div>
  );
};

export default ClientPortalInvoices;
