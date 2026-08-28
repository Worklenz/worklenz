import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
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
  Tag,
  Spin,
} from '@/shared/antd-imports';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  SendOutlined,
} from '@ant-design/icons';
import {
  useCreateInvoiceMutation,
  useGetRequestDetailsQuery,
  useGetOrganizationRequestsQuery,
  useGetInvoicesByRequestQuery,
  useGetInvoiceDetailsQuery,
  useUpdateInvoiceMutation,
} from '../../../../api/client-portal/client-portal-api';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import './invoice-builder.css';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY, getCurrencySymbol } from '@/shared/currencies';

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
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const requestId = searchParams.get('requestId');
  const isEditMode = !!invoiceId;

  const [form] = Form.useForm();

  // Fetch invoice details if editing
  const { data: invoiceData, isLoading: isLoadingInvoice } = useGetInvoiceDetailsQuery(
    invoiceId || '',
    {
      skip: !invoiceId,
    }
  );
  const existingInvoice = invoiceData?.body;

  // Fetch request details if requestId is provided
  const effectiveRequestId = existingInvoice?.request?.id || requestId;
  const { data: requestData } = useGetRequestDetailsQuery(effectiveRequestId || '', {
    skip: !effectiveRequestId,
  });
  const request = requestData?.body;

  // Selected request state (for when no requestId in URL)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(requestId);

  // Fetch existing invoices for the selected request
  const finalRequestId = requestId || selectedRequestId;
  const { data: existingInvoicesData } = useGetInvoicesByRequestQuery(finalRequestId || '', {
    skip: !finalRequestId,
  });
  const existingInvoices = existingInvoicesData?.body?.invoices || [];

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

  // Update line item
  const updateLineItem = (key: string, field: keyof InvoiceLineItem, value: any) => {
    setLineItems(
      lineItems.map(item => {
        if (item.key === key) {
          const updated = { ...item, [field]: value };
          // Recalculate amount
          if (field === 'quantity' || field === 'rate') {
            updated.amount = updated.quantity * updated.rate;
          }
          return updated;
        }
        return item;
      })
    );
  };

  // Handle request selection change
  const handleRequestChange = (newRequestId: string) => {
    setSelectedRequestId(newRequestId);

    // If we have request data, auto-populate the first line item with service info
    if (newRequestId) {
      const selectedRequest = requestsData?.body?.data?.find((req: any) => req.id === newRequestId);
      if (selectedRequest && lineItems.length > 0) {
        const serviceDescription =
          selectedRequest.service_name ||
          selectedRequest.request_data?.title ||
          selectedRequest.service_description ||
          '';

        // Update the first line item with the service description
        updateLineItem(lineItems[0].key, 'description', serviceDescription);
      }
    }
  };

  // Auto-populate service description when request data loads (for URL requestId case)
  React.useEffect(() => {
    if (request && lineItems.length > 0) {
      const serviceDescription =
        request.service_name || request.request_data?.title || request.service_description || '';

      // Only update if the first line item is empty
      if (!lineItems[0].description) {
        updateLineItem(lineItems[0].key, 'description', serviceDescription);
      }
    }
  }, [request, lineItems]);

  // Tax and discount state
  const [taxRate, setTaxRate] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Currency state
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);

  // Loading state for tracking which button was clicked
  const [savingAs, setSavingAs] = useState<'draft' | 'sent' | null>(null);

  // Create and update invoice mutations
  const [createInvoice, { isLoading: isCreating }] = useCreateInvoiceMutation();
  const [updateInvoice, { isLoading: isUpdating }] = useUpdateInvoiceMutation();
  const isSaving = isCreating || isUpdating;

  // Populate form when editing
  useEffect(() => {
    if (existingInvoice && isEditMode) {
      // Prevent editing paid invoices
      if (existingInvoice.status === 'paid') {
        message.error(
          t('cannotEditPaidInvoice', { defaultValue: 'Paid invoices cannot be edited' }) ||
            'Paid invoices cannot be edited'
        );
        navigate(`/worklenz/client-portal/invoices/${invoiceId}`);
        return;
      }

      // Set form values
      form.setFieldsValue({
        dueDate: existingInvoice.dueDate ? dayjs(existingInvoice.dueDate) : null,
        notes: existingInvoice.notes || '',
      });

      // Set currency
      setCurrency(existingInvoice.currency || DEFAULT_CURRENCY);

      // Set tax and discount values
      setTaxRate(existingInvoice.taxRate || 0);
      setDiscountType(existingInvoice.discountType || 'percentage');
      setDiscountValue(existingInvoice.discountValue || 0);

      // Set amount as single line item for simple invoices
      setLineItems([
        {
          key: generateKey(),
          description: existingInvoice.request?.service?.name || 'Service',
          quantity: 1,
          rate: existingInvoice.subtotal || existingInvoice.amount,
          amount: existingInvoice.subtotal || existingInvoice.amount,
        },
      ]);
    }
  }, [existingInvoice, isEditMode, form, navigate, invoiceId, t]);

  // Calculate totals
  const calculations = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const discount =
      discountType === 'percentage' ? (subtotal * discountValue) / 100 : discountValue;
    const taxableAmount = subtotal - discount;
    const tax = (taxableAmount * taxRate) / 100;
    const total = taxableAmount + tax;

    return { subtotal, discount, tax, total };
  }, [lineItems, taxRate, discountType, discountValue]);

  // Currency symbol
  const currencySymbol = useMemo(() => {
    return getCurrencySymbol(currency);
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

  // Line items table columns
  const columns: ColumnsType<InvoiceLineItem> = [
    {
      title:
        t('serviceDescription', { defaultValue: 'Service Description' }) || 'Service Description',
      dataIndex: 'description',
      key: 'description',
      render: (_, record) => (
        <Input
          value={record.description}
          onChange={e => updateLineItem(record.key, 'description', e.target.value)}
          placeholder={
            t('serviceDescriptionPlaceholder', { defaultValue: 'Enter service description' }) ||
            'Enter service description'
          }
          variant="borderless"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: t('itemQuantity', { defaultValue: 'Qty' }) || 'Qty',
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
      title: t('itemRate', { defaultValue: 'Rate' }) || 'Rate',
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
      title: t('itemAmount', { defaultValue: 'Amount' }) || 'Amount',
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
  const handleSubmit = async (status?: 'draft' | 'sent') => {
    if (isEditMode) {
      // Edit mode - update existing invoice
      if (!existingInvoice) return;

      setSavingAs(status || null);

      try {
        const values = await form.validateFields();
        const updateData = {
          amount: calculations.total,
          currency,
          dueDate: values.dueDate ? dayjs(values.dueDate).format('YYYY-MM-DD') : undefined,
          notes: values.notes,
          taxRate,
          taxAmount: calculations.tax,
          discountType,
          discountValue,
          discountAmount: calculations.discount,
          subtotal: calculations.subtotal,
        };

        await updateInvoice({ id: invoiceId!, data: updateData }).unwrap();
        message.success(
          t('updateInvoiceSuccessMessage', { defaultValue: 'Invoice updated successfully' }) ||
            'Invoice updated successfully'
        );
        navigate(`/worklenz/client-portal/invoices/${invoiceId}`);
      } catch (error) {
        message.error(
          t('updateInvoiceErrorMessage', { defaultValue: 'Failed to update invoice' }) ||
            'Failed to update invoice'
        );
      } finally {
        setSavingAs(null);
      }
    } else {
      // Create mode
      const finalRequestId = requestId || selectedRequestId;
      if (!finalRequestId) {
        message.error(
          t('selectRequestRequired', { defaultValue: 'Please select a request' }) ||
            'Please select a request'
        );
        return;
      }

      if (lineItems.every(item => !item.description || item.amount === 0)) {
        message.error(
          t('addAtLeastOneItem', { defaultValue: 'Please add at least one item' }) ||
            'Please add at least one item'
        );
        return;
      }

      setSavingAs(status || null);

      try {
        const values = await form.validateFields();
        const invoiceData = {
          requestId: finalRequestId,
          amount: calculations.total,
          currency,
          dueDate: values.dueDate ? dayjs(values.dueDate).format('YYYY-MM-DD') : undefined,
          notes: values.notes,
          status: status || 'draft',
          lineItems: lineItems.filter(item => item.description && item.amount > 0),
          taxRate,
          discountType,
          discountValue,
          subtotal: calculations.subtotal,
          discountAmount: calculations.discount,
          taxAmount: calculations.tax,
        };

        await createInvoice(invoiceData).unwrap();
        message.success(
          t('createInvoiceSuccessMessage', { defaultValue: 'Invoice created successfully' }) ||
            'Invoice created successfully'
        );
        navigate('/worklenz/client-portal/invoices');
      } catch (error) {
        message.error(
          t('createInvoiceErrorMessage', { defaultValue: 'Failed to create invoice' }) ||
            'Failed to create invoice'
        );
      } finally {
        setSavingAs(null);
      }
    }
  };

  // Show loading state when fetching invoice data
  if (isLoadingInvoice) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: '60vh' }}>
        <Spin
          size="large"
          tip={t('loadingInvoice', { defaultValue: 'Loading invoice...' }) || 'Loading invoice...'}
        />
      </Flex>
    );
  }

  return (
    <Flex vertical gap={24} style={{ width: '100%', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <Flex align="center" justify="space-between">
        <Flex gap={12} align="center">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} type="text" />
          <Typography.Title level={4} style={{ marginBlock: 0 }}>
            {isEditMode
              ? t('editInvoiceTitle', { defaultValue: 'Edit Invoice' }) || 'Edit Invoice'
              : t('invoiceBuilderTitle', { defaultValue: 'Create Invoice' }) || 'Create Invoice'}
          </Typography.Title>
        </Flex>
        <Space>
          {isEditMode ? (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => handleSubmit()}
              loading={isSaving}
            >
              {t('updateInvoice', { defaultValue: 'Update Invoice' }) || 'Update Invoice'}
            </Button>
          ) : (
            <>
              <Button
                icon={<SaveOutlined />}
                onClick={() => handleSubmit('draft')}
                loading={isSaving && savingAs === 'draft'}
              >
                {t('saveDraft', { defaultValue: 'Save Draft' }) || 'Save Draft'}
              </Button>
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={() => handleSubmit('sent')}
                loading={isSaving && savingAs === 'sent'}
              >
                {t('createAndSend', { defaultValue: 'Create & Send' }) || 'Create & Send'}
              </Button>
            </>
          )}
        </Space>
      </Flex>

      <Form form={form} layout="vertical">
        <Flex gap={24} style={{ width: '100%' }} wrap="wrap">
          {/* Left Column - Invoice Details */}
          <Flex vertical gap={24} style={{ flex: 2, minWidth: 500 }}>
            {/* Request Selection Card - show when no requestId in URL and not editing */}
            {!requestId && !isEditMode && (
              <Card
                size="small"
                title={
                  t('selectRequestLabel', { defaultValue: 'Select Request' }) || 'Select Request'
                }
              >
                <Select
                  showSearch
                  style={{ width: '100%' }}
                  placeholder={
                    t('searchRequestPlaceholder', {
                      defaultValue: 'Search by request number or title',
                    }) || 'Search by request number or title'
                  }
                  loading={isLoadingRequests}
                  options={requestOptions}
                  value={selectedRequestId}
                  onChange={handleRequestChange}
                  filterOption={(input, option) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                  notFoundContent={
                    t('noRequestsFound', { defaultValue: 'No requests found' }) ||
                    'No requests found'
                  }
                />
                <Typography.Text
                  type="secondary"
                  style={{ fontSize: 12, marginTop: 8, display: 'block' }}
                >
                  {t('selectRequestHelp', {
                    defaultValue:
                      'Only accepted, in-progress, and completed requests can be invoiced',
                  }) || 'Only accepted, in-progress, and completed requests can be invoiced'}
                </Typography.Text>

                {/* Show existing invoices warning when request is selected */}
                {selectedRequestId && existingInvoices.length > 0 && (
                  <Flex vertical gap={8} style={{ marginTop: 12 }}>
                    <Divider style={{ margin: '8px 0' }} />
                    <Flex align="center" gap={8}>
                      <Typography.Text type="warning" strong style={{ fontSize: 12 }}>
                        {t('existingInvoicesWarning', {
                          defaultValue: '⚠️ This request already has invoices:',
                        }) || '⚠️ This request already has invoices:'}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        ({existingInvoices.length}{' '}
                        {existingInvoices.length === 1 ? 'invoice' : 'invoices'})
                      </Typography.Text>
                    </Flex>
                    <Flex vertical gap={4} style={{ maxHeight: 120, overflowY: 'auto' }}>
                      {existingInvoices.map((invoice: any) => (
                        <Flex
                          key={invoice.id}
                          justify="space-between"
                          align="center"
                          style={{
                            padding: '4px 8px',
                            background: token.colorFillTertiary,
                            borderRadius: 4,
                          }}
                        >
                          <Flex align="center" gap={8}>
                            <Typography.Text style={{ fontSize: 12 }}>
                              {invoice.invoiceNo}
                            </Typography.Text>
                            <Tag
                              color={
                                invoice.status === 'paid'
                                  ? 'success'
                                  : invoice.status === 'sent'
                                    ? 'processing'
                                    : 'default'
                              }
                              style={{ fontSize: 11 }}
                            >
                              {invoice.status}
                            </Tag>
                          </Flex>
                          <Typography.Text style={{ fontSize: 12 }}>
                            {getCurrencySymbol(invoice.currency)}
                            {invoice.amount.toFixed(2)}
                          </Typography.Text>
                        </Flex>
                      ))}
                    </Flex>
                    <Typography.Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
                      {t('multipleInvoicesAllowed') ||
                        'You can create additional invoices for this request (e.g., for milestones or additional work).'}
                    </Typography.Text>
                  </Flex>
                )}
              </Card>
            )}

            {/* Request Info Card - show when requestId is provided or editing */}
            {(request || existingInvoice) && (requestId || isEditMode) && (
              <Card size="small">
                <Flex vertical gap={8}>
                  <Typography.Text type="secondary">
                    {t('linkedRequest', { defaultValue: 'Linked Request' }) || 'Linked Request'}
                  </Typography.Text>
                  <Flex justify="space-between" align="center">
                    <Flex vertical>
                      <Typography.Text strong>
                        {request?.req_no || existingInvoice?.request?.requestNumber || 'N/A'}
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        {request?.request_data?.title ||
                          request?.service_name ||
                          existingInvoice?.request?.service?.name ||
                          'N/A'}
                      </Typography.Text>
                    </Flex>
                    <Typography.Text>
                      {request?.client_name || existingInvoice?.client?.name || 'N/A'}
                    </Typography.Text>
                  </Flex>

                  {/* Show existing invoices warning */}
                  {existingInvoices.length > 0 && (
                    <Flex vertical gap={8} style={{ marginTop: 12 }}>
                      <Divider style={{ margin: '8px 0' }} />
                      <Flex align="center" gap={8}>
                        <Typography.Text type="warning" strong>
                          {t('existingInvoicesWarning', {
                            defaultValue: '⚠️ This request already has invoices:',
                          }) || '⚠️ This request already has invoices:'}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          ({existingInvoices.length}{' '}
                          {existingInvoices.length === 1 ? 'invoice' : 'invoices'})
                        </Typography.Text>
                      </Flex>
                      <Flex vertical gap={4} style={{ maxHeight: 120, overflowY: 'auto' }}>
                        {existingInvoices.map((invoice: any) => (
                          <Flex
                            key={invoice.id}
                            justify="space-between"
                            align="center"
                            style={{
                              padding: '4px 8px',
                              background: token.colorFillTertiary,
                              borderRadius: 4,
                            }}
                          >
                            <Flex align="center" gap={8}>
                              <Typography.Text style={{ fontSize: 12 }}>
                                {invoice.invoiceNo}
                              </Typography.Text>
                              <Tag
                                color={
                                  invoice.status === 'paid'
                                    ? 'success'
                                    : invoice.status === 'sent'
                                      ? 'processing'
                                      : 'default'
                                }
                                style={{ fontSize: 11 }}
                              >
                                {invoice.status}
                              </Tag>
                            </Flex>
                            <Typography.Text style={{ fontSize: 12 }}>
                              {getCurrencySymbol(invoice.currency)}
                              {invoice.amount.toFixed(2)}
                            </Typography.Text>
                          </Flex>
                        ))}
                      </Flex>
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 11, fontStyle: 'italic' }}
                      >
                        {t('multipleInvoicesAllowed', {
                          defaultValue:
                            'You can create additional invoices for this request (e.g., for milestones or additional work).',
                        }) ||
                          'You can create additional invoices for this request (e.g., for milestones or additional work).'}
                      </Typography.Text>
                    </Flex>
                  )}
                </Flex>
              </Card>
            )}

            {/* Line Items Card */}
            <Card
              title={t('servicesAndItems', { defaultValue: 'Services' }) || 'Services'}
              extra={
                <Button type="dashed" icon={<PlusOutlined />} onClick={addLineItem}>
                  {t('addService', { defaultValue: 'Add Service' }) || 'Add Service'}
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
            <Card title={t('notesLabel', { defaultValue: 'Notes' }) || 'Notes'}>
              <Form.Item name="notes" style={{ marginBottom: 0 }}>
                <Input.TextArea
                  rows={4}
                  placeholder={
                    t('invoiceNotesPlaceholder', {
                      defaultValue:
                        'Add payment terms, thank you message, or any additional notes...',
                    }) || 'Add payment terms, thank you message, or any additional notes...'
                  }
                />
              </Form.Item>
            </Card>
          </Flex>

          {/* Right Column - Summary */}
          <Flex vertical gap={24} style={{ flex: 1, minWidth: 320 }}>
            {/* Invoice Settings Card */}
            <Card
              title={
                t('invoiceSettings', { defaultValue: 'Invoice Settings' }) || 'Invoice Settings'
              }
            >
              <Flex vertical gap={16}>
                <Form.Item
                  label={t('currencyLabel', { defaultValue: 'Currency' }) || 'Currency'}
                  style={{ marginBottom: 0 }}
                >
                  <Select
                    value={currency}
                    onChange={setCurrency}
                    options={CURRENCY_OPTIONS}
                    optionFilterProp="label"
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                    }
                    notFoundContent={
                      t('noCurrenciesFound', { defaultValue: 'No currencies found' }) ||
                      'No currencies found'
                    }
                  />
                </Form.Item>

                <Form.Item
                  name="dueDate"
                  label={
                    <Flex gap={4} align="center">
                      <span>
                        {t('paymentDueDateLabel', { defaultValue: 'Payment Due Date' }) ||
                          'Payment Due Date'}
                      </span>
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12, fontWeight: 'normal' }}
                      >
                        ({t('optional', { defaultValue: 'Optional' }) || 'Optional'})
                      </Typography.Text>
                    </Flex>
                  }
                  style={{ marginBottom: 0 }}
                >
                  <DatePicker
                    style={{ width: '100%' }}
                    disabledDate={current => current && current < dayjs().startOf('day')}
                    placeholder={
                      t('selectDueDatePlaceholder', { defaultValue: 'Select payment due date' }) ||
                      'Select payment due date'
                    }
                  />
                </Form.Item>
              </Flex>
            </Card>

            {/* Tax & Discount Card */}
            <Card
              title={t('taxAndDiscount', { defaultValue: 'Tax & Discount' }) || 'Tax & Discount'}
            >
              <Flex vertical gap={16}>
                <Flex gap={8} align="center">
                  <Typography.Text style={{ width: 80 }}>
                    {t('discount', { defaultValue: 'Discount' }) || 'Discount'}
                  </Typography.Text>
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
                  <Typography.Text style={{ width: 80 }}>
                    {t('taxRate', { defaultValue: 'Tax' }) || 'Tax'}
                  </Typography.Text>
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
                  <Typography.Text>
                    {t('subtotal', { defaultValue: 'Subtotal' }) || 'Subtotal'}
                  </Typography.Text>
                  <Typography.Text>{formatCurrency(calculations.subtotal)}</Typography.Text>
                </Flex>

                {calculations.discount > 0 && (
                  <Flex justify="space-between">
                    <Typography.Text>
                      {t('discount', { defaultValue: 'Discount' }) || 'Discount'}
                    </Typography.Text>
                    <Typography.Text type="success">
                      -{formatCurrency(calculations.discount)}
                    </Typography.Text>
                  </Flex>
                )}

                {calculations.tax > 0 && (
                  <Flex justify="space-between">
                    <Typography.Text>
                      {t('tax', { defaultValue: 'Tax' }) || 'Tax'} ({taxRate}%)
                    </Typography.Text>
                    <Typography.Text>{formatCurrency(calculations.tax)}</Typography.Text>
                  </Flex>
                )}

                <Divider style={{ margin: '8px 0' }} />

                <Flex justify="space-between">
                  <Typography.Title level={5} style={{ marginBlock: 0 }}>
                    {t('total', { defaultValue: 'Total' }) || 'Total'}
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
