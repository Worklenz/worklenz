import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Card,
  Flex,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Typography,
  Divider,
  Table,
  Space,
  message,
  theme,
} from '@/shared/antd-imports';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useCreateInvoiceMutation, useGetRequestDetailsQuery, useGetOrganizationRequestsQuery } from '../../../../api/client-portal/client-portal-api';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import './invoice-builder.css';

interface InvoiceLineItem {
  key: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

const generateKey = () => Math.random().toString(36).substring(2, 9);

const InvoiceBuilder = () => {
  const { t } = useTranslation('client-portal-invoices');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('requestId');

  const [form] = Form.useForm();

  // Fetch request details if requestId is provided
  const { data: requestData } = useGetRequestDetailsQuery(requestId || '', {
    skip: !requestId,
  });
  const request = requestData?.body;

  // Selected request state (for when no requestId in URL)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(requestId);

  // Fetch requests for selection (only when no requestId provided)
  const { data: requestsData, isLoading: isLoadingRequests } = useGetOrganizationRequestsQuery(
    { limit: 100 },
    { skip: !!requestId }
  );

  // Filter to invoiceable requests (accepted, in_progress, completed)
  const requestOptions = useMemo(() => {
    const requests = requestsData?.body?.data || [];
    const invoiceableStatuses = ['accepted', 'in_progress', 'completed'];
    return requests
      .filter((req: any) => invoiceableStatuses.includes(req.status))
      .map((req: any) => ({
        value: req.id,
        label: `${req.req_no} - ${req.request_data?.title || req.service_name} (${req.client_name})`,
      }));
  }, [requestsData]);

  // Line items state
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    { key: generateKey(), description: '', quantity: 1, rate: 0, amount: 0 },
  ]);

  // Tax and discount state
  const [taxRate, setTaxRate] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Currency state
  const [currency, setCurrency] = useState<string>('USD');

  // Create invoice mutation
  const [createInvoice, { isLoading: isCreating }] = useCreateInvoiceMutation();

  // Calculate totals
  const calculations = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const discount = discountType === 'percentage' 
      ? (subtotal * discountValue) / 100 
      : discountValue;
    const taxableAmount = subtotal - discount;
    const tax = (taxableAmount * taxRate) / 100;
    const total = taxableAmount + tax;

    return { subtotal, discount, tax, total };
  }, [lineItems, taxRate, discountType, discountValue]);

  // Currency symbol
  const currencySymbol = useMemo(() => {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      LKR: 'Rs.',
    };
    return symbols[currency] || currency;
  }, [currency]);

  // Format currency
  const formatCurrency = (value: number) => {
    return `${currencySymbol}${value.toFixed(2)}`;
  };

  // Add new line item
  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { key: generateKey(), description: '', quantity: 1, rate: 0, amount: 0 },
    ]);
  };

  // Remove line item
  const removeLineItem = (key: string) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter(item => item.key !== key));
  };

  // Update line item
  const updateLineItem = (key: string, field: keyof InvoiceLineItem, value: any) => {
    setLineItems(lineItems.map(item => {
      if (item.key === key) {
        const updated = { ...item, [field]: value };
        // Recalculate amount
        if (field === 'quantity' || field === 'rate') {
          updated.amount = updated.quantity * updated.rate;
        }
        return updated;
      }
      return item;
    }));
  };

  // Line items table columns
  const columns: ColumnsType<InvoiceLineItem> = [
    {
      title: t('serviceDescription') || 'Service Description',
      dataIndex: 'description',
      key: 'description',
      render: (_, record) => (
        <Input
          value={record.description}
          onChange={e => updateLineItem(record.key, 'description', e.target.value)}
          placeholder={t('serviceDescriptionPlaceholder') || 'Enter service description'}
          variant="borderless"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: t('itemQuantity') || 'Qty',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      render: (_, record) => (
        <InputNumber
          value={record.quantity}
          onChange={value => updateLineItem(record.key, 'quantity', value || 0)}
          min={1}
          style={{ width: '100%' }}
          variant="borderless"
        />
      ),
    },
    {
      title: t('itemRate') || 'Rate',
      dataIndex: 'rate',
      key: 'rate',
      width: 140,
      render: (_, record) => (
        <InputNumber
          value={record.rate}
          onChange={value => updateLineItem(record.key, 'rate', value || 0)}
          min={0}
          step={0.01}
          precision={2}
          prefix={currencySymbol}
          style={{ width: '100%' }}
          variant="borderless"
        />
      ),
    },
    {
      title: t('itemAmount') || 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 140,
      render: (_, record) => (
        <Typography.Text strong>{formatCurrency(record.amount)}</Typography.Text>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeLineItem(record.key)}
          disabled={lineItems.length === 1}
        />
      ),
    },
  ];

  // Handle form submit
  const handleSubmit = async (values: any) => {
    // Validate request is selected
    const finalRequestId = requestId || selectedRequestId;
    if (!finalRequestId) {
      message.error(t('selectRequestRequired') || 'Please select a request');
      return;
    }

    // Validate at least one line item
    if (lineItems.every(item => !item.description || item.amount === 0)) {
      message.error(t('addAtLeastOneItem') || 'Please add at least one item');
      return;
    }

    try {
      const invoiceData = {
        requestId: finalRequestId,
        amount: calculations.total,
        currency,
        dueDate: values.dueDate ? dayjs(values.dueDate).format('YYYY-MM-DD') : undefined,
        notes: values.notes,
        lineItems: lineItems.filter(item => item.description && item.amount > 0),
        taxRate,
        discountType,
        discountValue,
        subtotal: calculations.subtotal,
        discountAmount: calculations.discount,
        taxAmount: calculations.tax,
      };

      await createInvoice(invoiceData).unwrap();
      message.success(t('createInvoiceSuccessMessage') || 'Invoice created successfully');
      navigate('/worklenz/client-portal/invoices');
    } catch (error) {
      message.error(t('createInvoiceErrorMessage') || 'Failed to create invoice');
    }
  };

  return (
    <Flex vertical gap={24} style={{ width: '100%', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <Flex align="center" justify="space-between">
        <Flex gap={12} align="center">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
            type="text"
          />
          <Typography.Title level={4} style={{ marginBlock: 0 }}>
            {t('invoiceBuilderTitle') || 'Create Invoice'}
          </Typography.Title>
        </Flex>
        <Space>
          <Button icon={<SaveOutlined />} onClick={() => form.submit()}>
            {t('saveDraft') || 'Save Draft'}
          </Button>
          <Button type="primary" icon={<SendOutlined />} onClick={() => form.submit()} loading={isCreating}>
            {t('createAndSend') || 'Create & Send'}
          </Button>
        </Space>
      </Flex>

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Flex gap={24} style={{ width: '100%' }} wrap="wrap">
          {/* Left Column - Invoice Details */}
          <Flex vertical gap={24} style={{ flex: 2, minWidth: 500 }}>
            {/* Request Selection Card - show when no requestId in URL */}
            {!requestId && (
              <Card size="small" title={t('selectRequestLabel') || 'Select Request'}>
                <Select
                  showSearch
                  style={{ width: '100%' }}
                  placeholder={t('searchRequestPlaceholder') || 'Search by request number or title'}
                  loading={isLoadingRequests}
                  options={requestOptions}
                  value={selectedRequestId}
                  onChange={setSelectedRequestId}
                  filterOption={(input, option) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                  notFoundContent={t('noRequestsFound') || 'No requests found'}
                />
                <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                  {t('selectRequestHelp') || 'Only accepted, in-progress, and completed requests can be invoiced'}
                </Typography.Text>
              </Card>
            )}

            {/* Request Info Card - show when requestId is provided */}
            {request && (
              <Card size="small">
                <Flex vertical gap={8}>
                  <Typography.Text type="secondary">{t('linkedRequest') || 'Linked Request'}</Typography.Text>
                  <Flex justify="space-between" align="center">
                    <Flex vertical>
                      <Typography.Text strong>{request.req_no}</Typography.Text>
                      <Typography.Text type="secondary">
                        {request.request_data?.title || request.service_name}
                      </Typography.Text>
                    </Flex>
                    <Typography.Text>{request.client_name}</Typography.Text>
                  </Flex>
                </Flex>
              </Card>
            )}

            {/* Line Items Card */}
            <Card 
              title={t('servicesAndItems') || 'Services'}
              extra={
                <Button type="dashed" icon={<PlusOutlined />} onClick={addLineItem}>
                  {t('addService') || 'Add Service'}
                </Button>
              }
            >
              <Table
                dataSource={lineItems}
                columns={columns}
                pagination={false}
                rowKey="key"
                size="small"
                className="invoice-builder-table"
                style={{ marginBottom: 16 }}
              />
            </Card>

            {/* Notes Card */}
            <Card title={t('notesLabel') || 'Notes'}>
              <Form.Item name="notes" style={{ marginBottom: 0 }}>
                <Input.TextArea
                  rows={4}
                  placeholder={t('invoiceNotesPlaceholder') || 'Add payment terms, thank you message, or any additional notes...'}
                />
              </Form.Item>
            </Card>
          </Flex>

          {/* Right Column - Summary */}
          <Flex vertical gap={24} style={{ flex: 1, minWidth: 320 }}>
            {/* Invoice Settings Card */}
            <Card title={t('invoiceSettings') || 'Invoice Settings'}>
              <Flex vertical gap={16}>
                <Form.Item 
                  label={t('currencyLabel') || 'Currency'} 
                  style={{ marginBottom: 0 }}
                >
                  <Select
                    value={currency}
                    onChange={setCurrency}
                    options={[
                      { value: 'USD', label: 'USD - US Dollar' },
                      { value: 'EUR', label: 'EUR - Euro' },
                      { value: 'GBP', label: 'GBP - British Pound' },
                      { value: 'LKR', label: 'LKR - Sri Lankan Rupee' },
                    ]}
                  />
                </Form.Item>

                <Form.Item 
                  name="dueDate" 
                  label={
                    <Flex gap={4} align="center">
                      <span>{t('paymentDueDateLabel') || 'Payment Due Date'}</span>
                      <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
                        ({t('optional') || 'Optional'})
                      </Typography.Text>
                    </Flex>
                  }
                  style={{ marginBottom: 0 }}
                >
                  <DatePicker
                    style={{ width: '100%' }}
                    disabledDate={(current) => current && current < dayjs().startOf('day')}
                    placeholder={t('selectDueDatePlaceholder') || 'Select payment due date'}
                  />
                </Form.Item>
              </Flex>
            </Card>

            {/* Tax & Discount Card */}
            <Card title={t('taxAndDiscount') || 'Tax & Discount'}>
              <Flex vertical gap={16}>
                <Flex gap={8} align="center">
                  <Typography.Text style={{ width: 80 }}>{t('discount') || 'Discount'}</Typography.Text>
                  <InputNumber
                    value={discountValue}
                    onChange={value => setDiscountValue(value || 0)}
                    min={0}
                    style={{ flex: 1 }}
                  />
                  <Select
                    value={discountType}
                    onChange={setDiscountType}
                    style={{ width: 80 }}
                    options={[
                      { value: 'percentage', label: '%' },
                      { value: 'fixed', label: currencySymbol },
                    ]}
                  />
                </Flex>

                <Flex gap={8} align="center">
                  <Typography.Text style={{ width: 80 }}>{t('taxRate') || 'Tax'}</Typography.Text>
                  <InputNumber
                    value={taxRate}
                    onChange={value => setTaxRate(value || 0)}
                    min={0}
                    max={100}
                    style={{ flex: 1 }}
                    suffix="%"
                  />
                </Flex>
              </Flex>
            </Card>

            {/* Summary Card */}
            <Card 
              style={{ 
                background: token.colorPrimaryBg,
                border: `1px solid ${token.colorPrimaryBorder}`,
              }}
            >
              <Flex vertical gap={12}>
                <Flex justify="space-between">
                  <Typography.Text>{t('subtotal') || 'Subtotal'}</Typography.Text>
                  <Typography.Text>{formatCurrency(calculations.subtotal)}</Typography.Text>
                </Flex>

                {calculations.discount > 0 && (
                  <Flex justify="space-between">
                    <Typography.Text>{t('discount') || 'Discount'}</Typography.Text>
                    <Typography.Text type="success">-{formatCurrency(calculations.discount)}</Typography.Text>
                  </Flex>
                )}

                {calculations.tax > 0 && (
                  <Flex justify="space-between">
                    <Typography.Text>{t('tax') || 'Tax'} ({taxRate}%)</Typography.Text>
                    <Typography.Text>{formatCurrency(calculations.tax)}</Typography.Text>
                  </Flex>
                )}

                <Divider style={{ margin: '8px 0' }} />

                <Flex justify="space-between">
                  <Typography.Title level={5} style={{ marginBlock: 0 }}>
                    {t('total') || 'Total'}
                  </Typography.Title>
                  <Typography.Title level={4} style={{ marginBlock: 0, color: token.colorPrimary }}>
                    {formatCurrency(calculations.total)}
                  </Typography.Title>
                </Flex>
              </Flex>
            </Card>
          </Flex>
        </Flex>
      </Form>
    </Flex>
  );
};

export default InvoiceBuilder;
