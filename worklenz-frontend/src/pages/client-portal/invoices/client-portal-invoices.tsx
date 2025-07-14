import { Flex, Typography } from 'antd';
import Button from 'antd/lib/button';

import { useTranslation } from 'react-i18next';
import InvoicesTable from './Invoices-table/invoices-table';
import AddInvoiceDrawer from '../../../features/clients-portal/invoices/add-invoice-drawer';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { toggleAddInvoiceDrawer } from '../../../features/clients-portal/invoices/invoices-slice';

const ClientPortalInvoices = () => {
  // localization
  const { t } = useTranslation('client-portal-requests');
  const dispatch = useAppDispatch();

  // function to handle add invoices
  const handleAddInvoice = () => {
    dispatch(toggleAddInvoiceDrawer());
  };

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" style={{ width: '100%' }}>
        <Typography.Title level={5}>{t('title')}</Typography.Title>

        <Button type="primary" onClick={handleAddInvoice}>
          Add Invoice
        </Button>
      </Flex>

      <InvoicesTable />

      {/* drawers  */}
      <AddInvoiceDrawer />
    </Flex>
  );
};

export default ClientPortalInvoices;