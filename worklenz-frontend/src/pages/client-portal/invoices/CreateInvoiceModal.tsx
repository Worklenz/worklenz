import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  DatePicker,
  Flex,
  Input,
  InputNumber,
  Modal,
  Select,
  Spin,
  Table,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  useCreateInvoiceMutation,
  useGetClientsQuery,
  useGetInvoiceDetailsQuery,
  useGetInvoicesByRequestQuery,
  useGetOrganizationRequestsQuery,
  useGetOrganizationServicesQuery,
  useUpdateInvoiceMutation,
} from '../../../api/client-portal/client-portal-api';
import type { ClientPortalInvoiceDetails } from '../../../api/client-portal/client-portal-api';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY, getCurrencySymbol } from '../../../shared/currencies';
import InvoicePreviewModal from './invoice-details/invoice-preview-modal';
import {
  computeInvoiceTotals,
  formatMoney,
  getInvoiceDownloadUrl,
  getLineAmount,
  isInvoiceableRequestStatus,
  type InvoiceDiscountType,
} from './invoices-list-helpers';
import './invoices.css';

const INVOICES_PATH = '/worklenz/client-portal/invoices';

interface LineItemRow {
  key: string;
  description: string;
  quantity: number;
  rate: number;
}

interface RequestRow {
  id: string;
  req_no: string;
  status: string;
  service_name?: string;
  client_id?: string;
  client_name?: string;
  request_data?: { title?: string };
}

const newKey = () => Math.random().toString(36).slice(2, 9);
const emptyLine = (description = ''): LineItemRow => ({
  key: newKey(),
  description,
  quantity: 1,
  rate: 0,
});

/**
 * Create (invoices/create) and edit (invoices/:id/edit) an invoice, opened as a modal over the
 * list. `?requestId=` pre-links a request and `?clientId=` pre-selects / narrows to one client.
 */
const CreateInvoiceModal = () => {
  const { t } = useTranslation('client-portal-invoices');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [searchParams] = useSearchParams();
  const requestIdParam = searchParams.get('requestId');
  const clientIdParam = searchParams.get('clientId');
  const isEditMode = Boolean(invoiceId);

  const [requestId, setRequestId] = useState<string | null>(requestIdParam);
  const [clientId, setClientId] = useState<string | null>(clientIdParam);
  const [projectName, setProjectName] = useState('');
  const [lineItems, setLineItems] = useState<LineItemRow[]>([emptyLine()]);
  const [notes, setNotes] = useState('');
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [dueDate, setDueDate] = useState<dayjs.Dayjs | null>(null);
  const [discountType, setDiscountType] = useState<InvoiceDiscountType>('percentage');
  const [discountValue, setDiscountValue] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [savingAs, setSavingAs] = useState<'draft' | 'sent' | 'update' | null>(null);
  const [hasLoadedExisting, setHasLoadedExisting] = useState(false);

  // Back to wherever this was opened from, or to the list for a direct link.
  const close = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(INVOICES_PATH);
  };

  const { data: existingData, isLoading: isLoadingExisting } = useGetInvoiceDetailsQuery(
    invoiceId ?? '',
    { skip: !invoiceId }
  );
  const existing = existingData?.body;

  const { data: requestsData, isLoading: isLoadingRequests } = useGetOrganizationRequestsQuery(
    { limit: 100, client_id: clientIdParam ?? undefined },
    { skip: isEditMode }
  );
  const { data: clientsData, isLoading: isLoadingClients } = useGetClientsQuery(
    { limit: 100 },
    { skip: isEditMode }
  );
  // The service field is editable in both create and edit mode, so this is never skipped.
  const { data: servicesData } = useGetOrganizationServicesQuery({ limit: 100 });
  const { data: requestInvoicesData } = useGetInvoicesByRequestQuery(requestId ?? '', {
    skip: !requestId || isEditMode,
  });

  const [createInvoice] = useCreateInvoiceMutation();
  const [updateInvoice] = useUpdateInvoiceMutation();

  // Only requests that staff have started acting on can be billed.
  const requests: RequestRow[] = useMemo(
    () =>
      ((requestsData?.body?.data ?? []) as RequestRow[]).filter(request =>
        isInvoiceableRequestStatus(request.status)
      ),
    [requestsData]
  );
  const selectedRequest = requests.find(request => request.id === requestId);
  const clients = clientsData?.body?.clients ?? [];
  const selectedClient = clients.find(client => client.id === (selectedRequest?.client_id ?? clientId));
  const relatedInvoices = requestInvoicesData?.body?.invoices ?? [];

  // Suggestions only: typing any other name is fine, it just won't match an existing service.
  const serviceOptions = useMemo(() => {
    const names = (servicesData?.body?.data ?? []) as Array<{ name?: string }>;
    const uniqueNames = Array.from(new Set(names.map(service => service.name?.trim()).filter(Boolean)));
    return uniqueNames.map(name => ({ value: name as string, label: name as string }));
  }, [servicesData]);

  // Populate from the invoice being edited (once).
  useEffect(() => {
    if (!existing || hasLoadedExisting) return;
    setHasLoadedExisting(true);
    setProjectName(existing.projectName ?? '');
    setNotes(existing.notes ?? '');
    setCurrency((existing.currency || DEFAULT_CURRENCY).toLowerCase());
    setDueDate(existing.dueDate ? dayjs(existing.dueDate) : null);
    setDiscountType(existing.discountType === 'fixed' ? 'fixed' : 'percentage');
    setDiscountValue(existing.discountValue ?? 0);
    setTaxRate(existing.taxRate ?? 0);
    setLineItems(
      existing.lineItems?.length
        ? existing.lineItems.map(item => ({
            key: newKey(),
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
          }))
        : [
            {
              key: newKey(),
              description: existing.request?.service?.name || existing.projectName || '',
              quantity: 1,
              rate: existing.subtotal || existing.amount,
            },
          ]
    );
  }, [existing, hasLoadedExisting]);

  // Prefill from a linked request (URL param or picked): project + one line for its service.
  const applyRequest = (request: RequestRow) => {
    setProjectName(request.request_data?.title || request.service_name || '');
    setLineItems([emptyLine(request.service_name || request.request_data?.title || '')]);
  };

  const [hasPrefilled, setHasPrefilled] = useState(false);
  useEffect(() => {
    if (hasPrefilled || isEditMode || !requestIdParam || !selectedRequest) return;
    setHasPrefilled(true);
    applyRequest(selectedRequest);
  }, [hasPrefilled, isEditMode, requestIdParam, selectedRequest]);

  const handlePickRequest = (value: string | undefined) => {
    if (!value) {
      // Clearing the request reverts to picking the client by hand.
      setRequestId(null);
      return;
    }
    setRequestId(value);
    const request = requests.find(item => item.id === value);
    if (request) {
      applyRequest(request);
      setClientId(request.client_id ?? null);
    }
  };

  const totals = useMemo(
    () => computeInvoiceTotals(lineItems, discountType, discountValue, taxRate),
    [lineItems, discountType, discountValue, taxRate]
  );
  const currencySymbol = getCurrencySymbol(currency);
  const money = (amount: number) => formatMoney(amount, currency);

  const updateLine = <K extends keyof LineItemRow>(key: string, field: K, value: LineItemRow[K]) =>
    setLineItems(rows => rows.map(row => (row.key === key ? { ...row, [field]: value } : row)));
  const addLine = () => setLineItems(rows => [...rows, emptyLine()]);
  // There is always at least one row.
  const removeLine = (key: string) =>
    setLineItems(rows => (rows.length > 1 ? rows.filter(row => row.key !== key) : rows));

  const lineColumns: ColumnsType<LineItemRow> = [
    {
      title: t('itemDescription', { defaultValue: 'Description' }),
      key: 'description',
      render: (_v, row) => (
        <Input
          size="small"
          value={row.description}
          placeholder={t('serviceDescriptionPlaceholder', {
            defaultValue: 'Enter service description',
          })}
          aria-label={t('itemDescription', { defaultValue: 'Description' })}
          onChange={event => updateLine(row.key, 'description', event.target.value)}
        />
      ),
    },
    {
      title: t('itemQuantity', { defaultValue: 'Qty' }),
      key: 'quantity',
      width: 80,
      render: (_v, row) => (
        <InputNumber
          size="small"
          min={0}
          value={row.quantity}
          aria-label={t('itemQuantity', { defaultValue: 'Qty' })}
          onChange={value => updateLine(row.key, 'quantity', Number(value) || 0)}
        />
      ),
    },
    {
      title: t('itemRate', { defaultValue: 'Rate' }),
      key: 'rate',
      width: 120,
      render: (_v, row) => (
        <InputNumber
          size="small"
          min={0}
          step={0.01}
          precision={2}
          prefix={currencySymbol}
          value={row.rate}
          aria-label={t('itemRate', { defaultValue: 'Rate' })}
          onChange={value => updateLine(row.key, 'rate', Number(value) || 0)}
        />
      ),
    },
    {
      title: t('itemAmount', { defaultValue: 'Amount' }),
      key: 'amount',
      width: 100,
      render: (_v, row) => <Typography.Text strong>{money(getLineAmount(row))}</Typography.Text>,
    },
    {
      title: '',
      key: 'remove',
      width: 40,
      render: (_v, row) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          disabled={lineItems.length === 1}
          aria-label={t('removeLineItem', { defaultValue: 'Remove item' })}
          onClick={() => removeLine(row.key)}
        />
      ),
    },
  ];

  const validLineItems = lineItems
    .filter(row => row.description.trim() && getLineAmount(row) > 0)
    .map(row => ({
      description: row.description.trim(),
      quantity: row.quantity,
      rate: row.rate,
      amount: getLineAmount(row),
    }));

  // Validates, returning a translated error or null.
  const validate = (): string | null => {
    if (!isEditMode && !requestId && !clientId) {
      return t('selectClientRequired', { defaultValue: 'Please select a client' });
    }
    if (validLineItems.length === 0) {
      return t('addAtLeastOneItem', {
        defaultValue: 'Please add at least one item with description and amount',
      });
    }
    return null;
  };

  const buildPayload = () => ({
    projectName: projectName.trim() || undefined,
    amount: totals.total,
    currency,
    // null (not undefined) so clearing the date on an edit actually clears it.
    dueDate: dueDate ? dueDate.format('YYYY-MM-DD') : null,
    notes,
    lineItems: validLineItems,
    taxRate,
    taxAmount: totals.taxAmount,
    discountType,
    discountValue,
    discountAmount: totals.discountAmount,
    subtotal: totals.subtotal,
  });

  const save = async (mode: 'draft' | 'sent' | 'update') => {
    const error = validate();
    if (error) {
      message.error(error);
      return;
    }

    setSavingAs(mode);
    try {
      if (isEditMode && invoiceId) {
        await updateInvoice({ id: invoiceId, data: buildPayload() }).unwrap();
        message.success(
          t('updateInvoiceSuccessMessage', { defaultValue: 'Invoice updated successfully' })
        );
        close();
        return;
      }

      const result = await createInvoice({
        ...buildPayload(),
        requestId: requestId ?? undefined,
        clientId: requestId ? undefined : (clientId ?? undefined),
        status: mode === 'sent' ? 'sent' : 'draft',
      }).unwrap();
      message.success(
        t('createInvoiceSuccessMessage', { defaultValue: 'Invoice created successfully' })
      );
      // Create & Download hands the person the file straight away.
      if (mode === 'sent' && result.body?.id) {
        window.open(getInvoiceDownloadUrl(result.body.id), '_blank', 'noopener,noreferrer');
      }
      navigate(INVOICES_PATH);
    } catch (err) {
      const serverMessage = (err as { data?: { message?: string } })?.data?.message;
      message.error(
        serverMessage ||
          (isEditMode
            ? t('updateInvoiceErrorMessage', { defaultValue: 'Failed to update invoice' })
            : t('createInvoiceErrorMessage', { defaultValue: 'Failed to create invoice' }))
      );
    } finally {
      setSavingAs(null);
    }
  };

  // What the preview shows: the form as it stands, with the saved invoice's own details when editing.
  const previewInvoice: ClientPortalInvoiceDetails = {
    id: existing?.id ?? '',
    invoiceNumber: existing?.invoiceNumber ?? t('draftInvoiceNumber', { defaultValue: 'Draft' }),
    amount: totals.total,
    currency,
    status: existing?.status ?? 'draft',
    paymentStatus: existing?.paymentStatus ?? 'unpaid',
    paidAmount: existing?.paidAmount ?? 0,
    projectName,
    dueDate: dueDate ? dueDate.format('YYYY-MM-DD') : '',
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: existing?.updatedAt ?? new Date().toISOString(),
    notes,
    lineItems: validLineItems,
    subtotal: totals.subtotal,
    taxRate,
    taxAmount: totals.taxAmount,
    discountType,
    discountValue,
    discountAmount: totals.discountAmount,
    request: selectedRequest
      ? {
          id: selectedRequest.id,
          requestNumber: selectedRequest.req_no,
          requestData: selectedRequest.request_data,
          service: { id: '', name: selectedRequest.service_name ?? '' },
        }
      : (existing?.request ?? null),
    client: existing?.client ?? {
      name: selectedRequest?.client_name ?? selectedClient?.name ?? '',
      companyName: selectedClient?.company_name,
      email: selectedClient?.email,
      phone: selectedClient?.phone,
      address: selectedClient?.address,
    },
    createdBy: existing?.createdBy ?? null,
    organization: existing?.organization,
  };

  const requestOptions = requests.map(request => ({
    value: request.id,
    label: `${request.req_no} - ${request.request_data?.title || request.service_name} (${request.client_name})`,
  }));

  const isPaid = existing?.paymentStatus === 'paid';
  const isLoading = isEditMode && isLoadingExisting;

  return (
    <>
      <Modal
        open
        onCancel={close}
        rootClassName="invoices-modal invoices-create-modal"
        width="min(960px, 96vw)"
        style={{ top: 24 }}
        maskClosable={false}
        title={
          isEditMode
            ? t('editInvoiceTitle', { defaultValue: 'Edit Invoice' })
            : t('createInvoiceTitle', { defaultValue: 'Create Invoice' })
        }
        styles={{ body: { maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' } }}
        footer={
          <Flex justify="flex-end" gap={8} wrap="wrap">
            <Button onClick={close}>
              {t('cancelButton', { defaultValue: 'Cancel' })}
            </Button>
            <Button onClick={() => setPreviewOpen(true)}>
              {t('previewInvoice', { defaultValue: 'Preview' })}
            </Button>
            {isEditMode ? (
              <Button
                type="primary"
                disabled={isPaid}
                loading={savingAs === 'update'}
                onClick={() => save('update')}
              >
                {t('updateInvoice', { defaultValue: 'Update Invoice' })}
              </Button>
            ) : (
              <>
                <Button loading={savingAs === 'draft'} onClick={() => save('draft')}>
                  {t('saveDraft', { defaultValue: 'Save Draft' })}
                </Button>
                <Button
                  type="primary"
                  loading={savingAs === 'sent'}
                  onClick={() => save('sent')}
                >
                  {t('createAndDownload', { defaultValue: 'Create & Download' })}
                </Button>
              </>
            )}
          </Flex>
        }
      >
        {isLoading ? (
          <Flex justify="center" style={{ padding: 48 }}>
            <Spin />
          </Flex>
        ) : (
          <div className="invoices-columns">
            <div className="invoices-column-main">
              <Flex vertical gap={16}>
                {isPaid && (
                  <Alert
                    type="warning"
                    showIcon
                    message={t('cannotEditPaidInvoice', {
                      defaultValue: 'Paid invoices cannot be edited',
                    })}
                  />
                )}

                {/* Linked request: picker when creating, read-only reference when editing. */}
                <Card size="small" title={t('selectRequestLabel', { defaultValue: 'Select Request' })}>
                  {isEditMode ? (
                    <Typography.Text>
                      {existing?.request
                        ? `${existing.request.requestNumber} - ${existing.request.service?.name ?? ''}`
                        : t('standaloneInvoice', { defaultValue: 'Standalone invoice (no request)' })}
                    </Typography.Text>
                  ) : (
                    <>
                      <Select
                        showSearch
                        allowClear
                        style={{ width: '100%' }}
                        loading={isLoadingRequests}
                        value={requestId ?? undefined}
                        options={requestOptions}
                        optionFilterProp="label"
                        placeholder={t('searchRequestPlaceholder', {
                          defaultValue: 'Search by request number or title',
                        })}
                        notFoundContent={t('noRequestsFound', { defaultValue: 'No requests found' })}
                        onChange={value => handlePickRequest(value)}
                        aria-label={t('selectRequestLabel', { defaultValue: 'Select Request' })}
                      />
                      <div className="invoices-help" style={{ color: token.colorTextSecondary, marginTop: 6 }}>
                        {t('selectRequestHelp', {
                          defaultValue:
                            'Only accepted, in-progress, and completed requests can be invoiced. Leave blank to create a standalone invoice.',
                        })}
                      </div>
                      {requestId && relatedInvoices.length > 0 && (
                        <div className="invoices-help" style={{ marginTop: 8, color: token.colorWarning }}>
                          {t('existingInvoicesWarning', {
                            count: relatedInvoices.length,
                            defaultValue: 'This request already has {{count}} invoice(s). You can create additional invoices for milestones or extra work.',
                          })}
                        </div>
                      )}
                    </>
                  )}
                </Card>

                <Card size="small" title={t('billingDetails', { defaultValue: 'Billing Details' })}>
                  <Flex vertical gap={12}>
                    <div>
                      <div className="invoices-detail-label">
                        {t('clientLabel', { defaultValue: 'Client' })}
                      </div>
                      {isEditMode || selectedRequest ? (
                        <Typography.Text strong>
                          {isEditMode
                            ? existing?.client?.name
                            : selectedRequest?.client_name}
                        </Typography.Text>
                      ) : (
                        <Select
                          showSearch
                          style={{ width: '100%' }}
                          loading={isLoadingClients}
                          value={clientId ?? undefined}
                          optionFilterProp="label"
                          placeholder={t('selectClientPlaceholder', { defaultValue: 'Select a client' })}
                          options={clients.map(client => ({ value: client.id, label: client.name }))}
                          onChange={value => setClientId(value)}
                          aria-label={t('clientLabel', { defaultValue: 'Client' })}
                        />
                      )}
                    </div>
                    <div>
                      <div className="invoices-detail-label">
                        {t('serviceLabel', { defaultValue: 'Service' })}
                      </div>
                      <AutoComplete
                        style={{ width: '100%' }}
                        value={projectName}
                        options={serviceOptions}
                        filterOption={(inputValue, option) =>
                          (option?.value as string)?.toLowerCase().includes(inputValue.toLowerCase())
                        }
                        onChange={setProjectName}
                        placeholder={t('serviceNamePlaceholder', {
                          defaultValue: 'Select a service or type a custom name',
                        })}
                        aria-label={t('serviceLabel', { defaultValue: 'Service' })}
                      />
                    </div>
                  </Flex>
                </Card>

                <Card
                  size="small"
                  className="invoices-line-items"
                  title={t('servicesAndItems', { defaultValue: 'Services' })}
                  extra={
                    <Button icon={<PlusOutlined />} onClick={addLine}>
                      {t('addService', { defaultValue: 'Add Service' })}
                    </Button>
                  }
                  styles={{ body: { padding: 0 } }}
                >
                  <Table
                    size="small"
                    rowKey="key"
                    pagination={false}
                    dataSource={lineItems}
                    columns={lineColumns}
                    scroll={{ x: 'max-content' }}
                  />
                </Card>

                <Card size="small" title={t('notesLabel', { defaultValue: 'Notes' })}>
                  <Input.TextArea
                    rows={3}
                    value={notes}
                    onChange={event => setNotes(event.target.value)}
                    placeholder={t('invoiceNotesPlaceholder', {
                      defaultValue: 'Add payment terms, thank you message, or any additional notes...',
                    })}
                  />
                </Card>
              </Flex>
            </div>

            <div className="invoices-column-side">
              <Flex vertical gap={16}>
                <Card size="small" title={t('invoiceSettings', { defaultValue: 'Invoice Settings' })}>
                  <Flex vertical gap={12}>
                    <div>
                      <div className="invoices-detail-label">
                        {t('currencyLabel', { defaultValue: 'Currency' })}
                      </div>
                      <Select
                        showSearch
                        style={{ width: '100%' }}
                        value={currency}
                        options={CURRENCY_OPTIONS}
                        optionFilterProp="label"
                        onChange={setCurrency}
                        notFoundContent={t('noCurrenciesFound', { defaultValue: 'No currencies found' })}
                        aria-label={t('currencyLabel', { defaultValue: 'Currency' })}
                      />
                    </div>
                    <div>
                      <div className="invoices-detail-label">
                        {t('paymentDueDateLabel', { defaultValue: 'Payment Due Date' })} (
                        {t('optional', { defaultValue: 'Optional' })})
                      </div>
                      <DatePicker
                        style={{ width: '100%' }}
                        value={dueDate}
                        onChange={setDueDate}
                        placeholder={t('selectDueDatePlaceholder', {
                          defaultValue: 'Select payment due date',
                        })}
                      />
                    </div>
                  </Flex>
                </Card>

                <Card size="small" title={t('taxAndDiscount', { defaultValue: 'Tax & Discount' })}>
                  <Flex vertical gap={12}>
                    <div>
                      <div className="invoices-detail-label">
                        {t('discount', { defaultValue: 'Discount' })}
                      </div>
                      <Flex gap={8}>
                        <InputNumber
                          style={{ flex: 1 }}
                          min={0}
                          value={discountValue}
                          aria-label={t('discount', { defaultValue: 'Discount' })}
                          onChange={value => setDiscountValue(Number(value) || 0)}
                        />
                        <Select
                          style={{ width: 70 }}
                          value={discountType}
                          onChange={setDiscountType}
                          options={[
                            { value: 'percentage', label: '%' },
                            { value: 'fixed', label: currencySymbol },
                          ]}
                          aria-label={t('discountType', { defaultValue: 'Discount type' })}
                        />
                      </Flex>
                    </div>
                    <div>
                      <div className="invoices-detail-label">{t('taxRate', { defaultValue: 'Tax' })} (%)</div>
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0}
                        max={100}
                        value={taxRate}
                        aria-label={t('taxRate', { defaultValue: 'Tax' })}
                        onChange={value => setTaxRate(Number(value) || 0)}
                      />
                    </div>
                  </Flex>
                </Card>

                <Card
                  size="small"
                  style={{
                    background: token.colorPrimaryBg,
                    border: `1px solid ${token.colorPrimaryBorder}`,
                  }}
                >
                  <Flex vertical gap={8}>
                    <Flex justify="space-between">
                      <Typography.Text type="secondary">
                        {t('subtotal', { defaultValue: 'Subtotal' })}
                      </Typography.Text>
                      <Typography.Text>{money(totals.subtotal)}</Typography.Text>
                    </Flex>
                    {totals.discountAmount > 0 && (
                      <Flex justify="space-between">
                        <Typography.Text type="secondary">
                          {t('discount', { defaultValue: 'Discount' })}
                        </Typography.Text>
                        <Typography.Text type="success">-{money(totals.discountAmount)}</Typography.Text>
                      </Flex>
                    )}
                    {totals.taxAmount > 0 && (
                      <Flex justify="space-between">
                        <Typography.Text type="secondary">
                          {t('tax', { defaultValue: 'Tax' })} ({taxRate}%)
                        </Typography.Text>
                        <Typography.Text>{money(totals.taxAmount)}</Typography.Text>
                      </Flex>
                    )}
                    <Flex
                      justify="space-between"
                      style={{ paddingTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}` }}
                    >
                      <Typography.Text strong style={{ fontSize: 14 }}>
                        {t('total', { defaultValue: 'Total' })}
                      </Typography.Text>
                      <Typography.Text strong style={{ fontSize: 14, color: token.colorPrimary }}>
                        {money(totals.total)}
                      </Typography.Text>
                    </Flex>
                  </Flex>
                </Card>
              </Flex>
            </div>
          </div>
        )}
      </Modal>

      <InvoicePreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        invoice={previewInvoice}
      />
    </>
  );
};

export default CreateInvoiceModal;
