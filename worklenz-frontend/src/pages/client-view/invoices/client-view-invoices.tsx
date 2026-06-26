import { Flex, Typography } from '@/shared/antd-imports';
import Button from 'antd/lib/button';

import { useTranslation } from 'react-i18next';
import InvoicesTable from './Invoices-table/invoices-table';
// Removed AddInvoiceDrawer import
// import AddInvoiceDrawer from '../../../features/client-view/invoices/add-invoice-drawer';
// import { useAppDispatch } from '../../../hooks/useAppDispatch';
// import { toggleAddInvoiceDrawer } from '../../../features/client-view/invoices/invoices-slice';

const ClientViewInvoices = () => {
  // localization
  const { t } = useTranslation('client-portal-requests');
  // const dispatch = useAppDispatch();

  // function to handle add invoices
  // const handleAddInvoice = () => {
  //   dispatch(toggleAddInvoiceDrawer());
  // };

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" style={{ width: '100%' }}>
        <Typography.Title level={5}>{t('title')}</Typography.Title>
      </Flex>

      <InvoicesTable />

      {/* drawers  */}
      {/* <AddInvoiceDrawer /> */}
    </Flex>
  );
};

export default ClientViewInvoices;
