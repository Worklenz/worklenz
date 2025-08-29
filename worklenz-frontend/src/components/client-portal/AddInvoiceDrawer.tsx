import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Button,
  Typography,
  Space,
  message,
  Row,
  Col,
  Divider,
  Card,
} from '@/shared/antd-imports';
import { 
  FileDoneOutlined, 
  PlusOutlined, 
  DollarOutlined,
  CalendarOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  useGetClientsQuery,
  useGetRequestsQuery,
} from '@/api/client-portal/client-portal-api';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;
const { Title } = Typography;

interface AddInvoiceDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface InvoiceForm {
  clientId: string;
  requestId?: string;
  amount: number;
  currency: string;
  dueDate: dayjs.Dayjs;
  description?: string;
  notes?: string;
  items: InvoiceItem[];
}

interface InvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

const AddInvoiceDrawer: React.FC<AddInvoiceDrawerProps> = ({ open, onClose, onSuccess }) => {
  const { t } = useTranslation(['client-portal-invoices', 'common']);
  const [form] = Form.useForm<InvoiceForm>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([{
    description: '',
    quantity: 1,
    rate: 0,
    amount: 0
  }]);

  // Get available clients and requests
  const { data: clientsData, isLoading: isLoadingClients } = useGetClientsQuery({});
  const { data: requestsData, isLoading: isLoadingRequests } = useGetRequestsQuery();

  useEffect(() => {
    if (open) {
      // Reset form when drawer opens
      form.resetFields();
      setItems([{
        description: '',
        quantity: 1,
        rate: 0,
        amount: 0
      }]);
      
      // Set default values
      form.setFieldsValue({
        currency: 'USD',
        dueDate: dayjs().add(30, 'days'), // 30 days from today
      });
    }
  }, [open, form]);

  const handleSubmit = async (values: InvoiceForm) => {
    try {
      setIsSubmitting(true);

      const invoiceData = {
        ...values,
        dueDate: values.dueDate.format('YYYY-MM-DD'),
        items,
        totalAmount: items.reduce((total, item) => total + item.amount, 0),
        status: 'draft',
      };

      // TODO: Create API endpoint for creating invoices
      // await createInvoice(invoiceData).unwrap();
      console.log('Creating invoice with data:', invoiceData);

      message.success(t('invoiceCreatedSuccessfully', { ns: 'client-portal-invoices' }) || 'Invoice created successfully!');
      onClose();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create invoice:', error);
      message.error(t('invoiceCreateFailed', { ns: 'client-portal-invoices' }) || 'Failed to create invoice. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addItem = () => {
    setItems([...items, {
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0
    }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index);
      setItems(newItems);
    }
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Calculate amount when quantity or rate changes
    if (field === 'quantity' || field === 'rate') {
      newItems[index].amount = newItems[index].quantity * newItems[index].rate;
    }
    
    setItems(newItems);
  };

  const getTotalAmount = () => {
    return items.reduce((total, item) => total + item.amount, 0);
  };

  const clients = clientsData?.body?.clients || [];
  const requests = requestsData?.body?.requests || [];

  return (
    <Drawer
      title={
        <Space>
          <FileDoneOutlined />
          <span>{t('addInvoice', { ns: 'client-portal-invoices' }) || 'Create New Invoice'}</span>
        </Space>
      }
      width={800}
      open={open}
      onClose={onClose}
      destroyOnClose
      maskClosable={false}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        scrollToFirstError
      >
        <Row gutter={[16, 0]}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="clientId"
              label={
                <Space>
                  <UserOutlined />
                  {t('client', { ns: 'common' }) || 'Client'}
                </Space>
              }
              rules={[{ required: true, message: t('clientRequired', { ns: 'common' }) || 'Please select a client' }]}
            >
              <Select
                placeholder={t('selectClient', { ns: 'client-portal-invoices' }) || 'Select client'}
                loading={isLoadingClients}
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                }
              >
                {clients.map((client: any) => (
                  <Option key={client.id} value={client.id}>
                    {client.name} {client.company_name && `(${client.company_name})`}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12}>
            <Form.Item
              name="requestId"
              label={t('relatedRequest', { ns: 'client-portal-invoices' }) || 'Related Request (Optional)'}
            >
              <Select
                placeholder={t('selectRequest', { ns: 'client-portal-invoices' }) || 'Select request (optional)'}
                loading={isLoadingRequests}
                allowClear
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                }
              >
                {requests.map((request: any) => (
                  <Option key={request.id} value={request.id}>
                    {request.requestNumber} - {request.serviceName}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={[16, 0]}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="currency"
              label={
                <Space>
                  <DollarOutlined />
                  {t('currency', { ns: 'client-portal-invoices' }) || 'Currency'}
                </Space>
              }
              rules={[{ required: true, message: t('currencyRequired', { ns: 'common' }) || 'Please select currency' }]}
            >
              <Select placeholder={t('selectCurrency', { ns: 'client-portal-invoices' }) || 'Select currency'}>
                <Option value="USD">USD ($)</Option>
                <Option value="EUR">EUR (€)</Option>
                <Option value="GBP">GBP (£)</Option>
                <Option value="CAD">CAD (C$)</Option>
                <Option value="AUD">AUD (A$)</Option>
              </Select>
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12}>
            <Form.Item
              name="dueDate"
              label={
                <Space>
                  <CalendarOutlined />
                  {t('dueDate', { ns: 'client-portal-invoices' }) || 'Due Date'}
                </Space>
              }
              rules={[{ required: true, message: t('dueDateRequired', { ns: 'common' }) || 'Please select due date' }]}
            >
              <DatePicker 
                style={{ width: '100%' }}
                disabledDate={(current) => current && current < dayjs().startOf('day')}
                format="YYYY-MM-DD"
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="description"
          label={t('description', { ns: 'common' }) || 'Description'}
        >
          <TextArea
            placeholder={t('invoiceDescriptionPlaceholder', { ns: 'client-portal-invoices' }) || 'Brief description of the invoice'}
            rows={2}
          />
        </Form.Item>

        <Divider orientation="left">
          <Title level={5}>{t('invoiceItems', { ns: 'client-portal-invoices' }) || 'Invoice Items'}</Title>
        </Divider>

        <Card>
          {items.map((item, index) => (
            <div key={index} style={{ marginBottom: index < items.length - 1 ? 16 : 0 }}>
              <Row gutter={[8, 8]} align="middle">
                <Col xs={24} sm={10}>
                  <Input
                    placeholder={t('itemDescription', { ns: 'client-portal-invoices' }) || 'Item description'}
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                  />
                </Col>
                <Col xs={6} sm={3}>
                  <InputNumber
                    min={1}
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(value) => updateItem(index, 'quantity', value || 1)}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col xs={8} sm={4}>
                  <InputNumber
                    min={0}
                    step={0.01}
                    placeholder="Rate"
                    value={item.rate}
                    onChange={(value) => updateItem(index, 'rate', value || 0)}
                    style={{ width: '100%' }}
                    addonBefore="$"
                  />
                </Col>
                <Col xs={8} sm={4}>
                  <InputNumber
                    value={item.amount}
                    disabled
                    style={{ width: '100%' }}
                    addonBefore="$"
                    precision={2}
                  />
                </Col>
                <Col xs={2} sm={3}>
                  <Button
                    type="text"
                    danger
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                  >
                    Remove
                  </Button>
                </Col>
              </Row>
              {index < items.length - 1 && <Divider style={{ margin: '16px 0 0 0' }} />}
            </div>
          ))}
          
          <Button
            type="dashed"
            onClick={addItem}
            icon={<PlusOutlined />}
            style={{ width: '100%', marginTop: 16 }}
          >
            {t('addItem', { ns: 'client-portal-invoices' }) || 'Add Item'}
          </Button>

          <div style={{ textAlign: 'right', marginTop: 16, padding: 16, backgroundColor: '#fafafa' }}>
            <Title level={4}>
              {t('total', { ns: 'common' }) || 'Total'}: ${getTotalAmount().toFixed(2)}
            </Title>
          </div>
        </Card>

        <Form.Item
          name="notes"
          label={t('notes', { ns: 'common' }) || 'Notes'}
          style={{ marginTop: 24 }}
        >
          <TextArea
            placeholder={t('invoiceNotesPlaceholder', { ns: 'client-portal-invoices' }) || 'Additional notes or terms'}
            rows={3}
          />
        </Form.Item>

        <div style={{ textAlign: 'right', marginTop: 32, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          <Space>
            <Button onClick={onClose} disabled={isSubmitting}>
              {t('cancel', { ns: 'common' }) || 'Cancel'}
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={isSubmitting}
              icon={<FileDoneOutlined />}
            >
              {t('createInvoice', { ns: 'client-portal-invoices' }) || 'Create Invoice'}
            </Button>
          </Space>
        </div>
      </Form>
    </Drawer>
  );
};

export default AddInvoiceDrawer;