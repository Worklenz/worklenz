import { Button, Drawer, Flex, Form, Input, message, Typography } from '@/shared/antd-imports';
import { useAppSelector } from '../../../hooks/useAppSelector';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { nanoid } from '@reduxjs/toolkit';
import { useTranslation } from 'react-i18next';
import { addInvoice, toggleAddInvoiceDrawer } from './invoices-slice';

const AddInvoiceDrawer = () => {
  // localization
  const { t } = useTranslation('client-portal-invoices');

  // get drawer state from invoice reducer
  const isDrawerOpen = useAppSelector(
    state => state.clientsPortalReducer.invoicesReducer.isAddInvoiceDrawerOpen
  );
  const dispatch = useAppDispatch();

  const [form] = Form.useForm();

  // this function for handle form submit
  const handleFormSubmit = async (values: any) => {
    try {
      const newInvoice = {
        id: nanoid(),
        invoice_no: `INV-${Date.now()}`,
        client_name: values.client_name || 'Unknown Client',
        service: values.service || 'Unknown Service',
        status: 'pending' as const,
        issued_time: new Date().toISOString().split('T')[0],
      };

      dispatch(addInvoice(newInvoice));
      dispatch(toggleAddInvoiceDrawer());
      form.resetFields();
      message.success(t('createInvoiceSuccessMessage') || 'Invoice created successfully');
    } catch (error) {
      message.error(t('createInvoiceErrorMessage') || 'Failed to create invoice');
    }
  };

  return (
    <Drawer
      title={
        <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>Create Invoice</Typography.Text>
      }
      open={isDrawerOpen}
      onClose={() => dispatch(toggleAddInvoiceDrawer())}
    >
      <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
        <Form.Item
          name="request"
          label="Select Request"
          rules={[
            {
              required: true,
              message: 'Please select a request',
            },
          ]}
        >
          <Input placeholder="Search by request number" />
        </Form.Item>

        <Form.Item>
          <Flex gap={8} justify="flex-end">
            <Button onClick={() => dispatch(toggleAddInvoiceDrawer())}>Cancel</Button>
            <Button type="primary" htmlType="submit">
              Create Invoice
            </Button>
          </Flex>
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default AddInvoiceDrawer;
