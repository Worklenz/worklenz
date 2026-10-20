import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Card,
  DatePicker,
  Flex,
  Input,
  InputNumber,
  Modal,
  Select,
  Table,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useGetClientsQuery } from '../../../api/client-portal/client-portal-api';
import { useGetBillableChangeRequestsQuery } from '../../../api/client-portal/portal-workflow-api';
import { ChangeRequestPicker } from '../../../components/client-portal/v2/ChangeRequestPicker';
import { portalPaths } from '../portal-paths';
import { useCreateQuoteMutation } from '../../../api/client-portal/client-portal-quotes-api';
import type { ClientPortalQuoteDetails } from '../../../api/client-portal/client-portal-quotes-api';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY, getCurrencySymbol } from '../../../shared/currencies';
import QuotePreviewModal from './quote-preview-modal';
import { decodeHtmlEntities } from '@/utils/html-entities';
import {
  computeInvoiceTotals,
  formatMoney,
  getLineAmount,
  getQuoteDownloadUrl,
  type InvoiceDiscountType,
} from './quotes-list-helpers';
import '../invoices/invoices.css';
import { RichTextField } from '../shared/rich-text/RichTextField';

const QUOTES_PATH = '/worklenz/client-portal/quotes';

interface LineItemRow {
  key: string;
  description: string;
  quantity: number;
  rate: number;
}

const newKey = () => Math.random().toString(36).slice(2, 9);
const emptyLine = (description = ''): LineItemRow => ({
  key: newKey(),
  description,
  quantity: 1,
  rate: 0,
});

/**
 * Create a quote (quotes/create), opened as a modal over the list. `?changeRequestId=` starts it from a
 * change request (its title becomes the first line, quantity 1, rate 0) and `?clientId=` pre-selects /
 * narrows to one client.
 */
const CreateQuoteModal = () => {
  const { t } = useTranslation('client-portal-quotes');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const changeRequestIdParam = searchParams.get('changeRequestId');
  const clientIdParam = searchParams.get('clientId');

  const [changeRequestId, setChangeRequestId] = useState<string | null>(changeRequestIdParam);
  const [clientId, setClientId] = useState<string | null>(clientIdParam);
  const [projectName, setProjectName] = useState('');
  const [lineItems, setLineItems] = useState<LineItemRow[]>([emptyLine()]);
  const [notes, setNotes] = useState('');
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [validUntil, setValidUntil] = useState<dayjs.Dayjs | null>(null);
  const [discountType, setDiscountType] = useState<InvoiceDiscountType>('percentage');
  const [discountValue, setDiscountValue] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [savingAs, setSavingAs] = useState<'draft' | 'sent' | null>(null);
  const [hasPrefilled, setHasPrefilled] = useState(false);

  // Back to wherever this was opened from, or to the list for a direct link.
  const close = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(QUOTES_PATH);
  };

  // Only approved, in-progress and completed change requests can be quoted (and the list is narrowed to the client).
  const { data: changeRequestsData, isLoading: isLoadingChangeRequests } = useGetBillableChangeRequestsQuery({
    organization_id: clientIdParam ?? undefined,
  });
  const { data: clientsData, isLoading: isLoadingClients } = useGetClientsQuery({ limit: 100 });

  const [createQuote] = useCreateQuoteMutation();

  const changeRequests = useMemo(() => changeRequestsData?.body ?? [], [changeRequestsData]);
  const selectedChangeRequest = changeRequests.find(item => item.id === changeRequestId);
  const clients = clientsData?.body?.clients ?? [];
  const selectedClient = clients.find(
    client => client.id === (selectedChangeRequest?.organization_id ?? clientId)
  );

  // Prefill from a change request: its title is the project and the first line (quantity 1, rate 0).
  const applyChangeRequest = (title: string) => {
    setProjectName(title);
    setLineItems([emptyLine(title)]);
  };

  useEffect(() => {
    if (hasPrefilled || !changeRequestIdParam || !selectedChangeRequest) return;
    setHasPrefilled(true);
    applyChangeRequest(selectedChangeRequest.title);
  }, [hasPrefilled, changeRequestIdParam, selectedChangeRequest]);

  const handlePickChangeRequest = (changeRequest: { id: string; title: string; organization_id: string } | null) => {
    if (!changeRequest) {
      // Clearing the request reverts to picking the client by hand.
      setChangeRequestId(null);
      return;
    }
    setChangeRequestId(changeRequest.id);
    applyChangeRequest(changeRequest.title);
    setClientId(changeRequest.organization_id);
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
          placeholder={t('itemDescriptionPlaceholder', { defaultValue: 'Enter item description' })}
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
    if (!changeRequestId && !clientId) {
      return t('selectClientRequired', { defaultValue: 'Please select a client' });
    }
    if (validLineItems.length === 0) {
      return t('addAtLeastOneItem', {
        defaultValue: 'Please add at least one item with description and amount',
      });
    }
    return null;
  };

  const save = async (mode: 'draft' | 'sent') => {
    const error = validate();
    if (error) {
      message.error(error);
      return;
    }

    setSavingAs(mode);
    try {
      const result = await createQuote({
        changeRequestId: changeRequestId ?? undefined,
        clientId: changeRequestId ? undefined : (clientId ?? undefined),
        projectName: projectName.trim() || undefined,
        currency,
        validUntil: validUntil ? validUntil.format('YYYY-MM-DD') : null,
        notes,
        lineItems: validLineItems,
        taxRate,
        discountType,
        discountValue,
        status: mode,
      }).unwrap();
      message.success(t('createQuoteSuccessMessage', { defaultValue: 'Quote created successfully' }));
      // Create & Download hands the person the file straight away.
      if (mode === 'sent' && result.body?.id) {
        window.open(getQuoteDownloadUrl(result.body.id), '_blank', 'noopener,noreferrer');
      }
      // Started from a change request: go back to it, where the new quote now shows under Linked work.
      navigate(changeRequestIdParam ? portalPaths.changeRequest(changeRequestIdParam) : QUOTES_PATH);
    } catch (err) {
      const serverMessage = (err as { data?: { message?: string } })?.data?.message;
      message.error(
        serverMessage || t('createQuoteErrorMessage', { defaultValue: 'Failed to create quote' })
      );
    } finally {
      setSavingAs(null);
    }
  };

  // What the preview shows: the form as it stands (unsaved, so no id and no download).
  const previewQuote: ClientPortalQuoteDetails = {
    id: '',
    quoteNumber: t('draftQuoteNumber', { defaultValue: 'Draft' }),
    amount: totals.total,
    currency,
    status: 'draft',
    projectName,
    validUntil: validUntil ? validUntil.format('YYYY-MM-DD') : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes,
    lineItems: validLineItems,
    subtotal: totals.subtotal,
    taxRate,
    taxAmount: totals.taxAmount,
    discountType,
    discountValue,
    discountAmount: totals.discountAmount,
    request: null,
    changeRequest: selectedChangeRequest
      ? {
          id: selectedChangeRequest.id,
          number: selectedChangeRequest.cr_no,
          title: selectedChangeRequest.title,
          status: selectedChangeRequest.status,
        }
      : null,
    client: {
      name: selectedClient?.name ?? '',
      companyName: selectedClient?.company_name,
      email: selectedClient?.email,
      phone: selectedClient?.phone,
      address: selectedClient?.address,
    },
    createdBy: null,
  };

  return (
    <>
      <Modal
        open
        onCancel={close}
        rootClassName="invoices-modal invoices-create-modal"
        width="min(960px, 96vw)"
        style={{ top: 24 }}
        maskClosable={false}
        title={t('createQuoteTitle', { defaultValue: 'Create Quote' })}
        styles={{ body: { maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' } }}
        footer={
          <Flex justify="flex-end" gap={8} wrap="wrap">
            <Button onClick={close}>{t('cancelButton', { defaultValue: 'Cancel' })}</Button>
            <Button onClick={() => setPreviewOpen(true)}>
              {t('previewQuote', { defaultValue: 'Preview' })}
            </Button>
            <Button loading={savingAs === 'draft'} disabled={savingAs === 'sent'} onClick={() => save('draft')}>
              {t('saveDraft', { defaultValue: 'Save Draft' })}
            </Button>
            <Button
              type="primary"
              loading={savingAs === 'sent'}
              disabled={savingAs === 'draft'}
              onClick={() => save('sent')}
            >
              {t('createAndDownload', { defaultValue: 'Create & Download' })}
            </Button>
          </Flex>
        }
      >
        <div className="invoices-columns">
          <div className="invoices-column-main">
            <Flex vertical gap={16}>
              <ChangeRequestPicker
                document="quote"
                changeRequests={changeRequests}
                isLoading={isLoadingChangeRequests}
                value={changeRequestId}
                onChange={handlePickChangeRequest}
              />

              <Card size="small" title={t('billingDetails', { defaultValue: 'Billing Details' })}>
                <Flex vertical gap={12}>
                  <div>
                    <div className="invoices-detail-label">
                      {t('clientLabel', { defaultValue: 'Client' })}
                    </div>
                    {selectedChangeRequest ? (
                      <Typography.Text strong>
                        {decodeHtmlEntities(selectedClient?.name) ?? ''}
                      </Typography.Text>
                    ) : (
                      <Select
                        showSearch
                        style={{ width: '100%' }}
                        loading={isLoadingClients}
                        value={clientId ?? undefined}
                        optionFilterProp="label"
                        placeholder={t('selectClientPlaceholder', { defaultValue: 'Select a client' })}
                        options={clients.map(client => ({
                          value: client.id,
                          label: decodeHtmlEntities(client.name),
                        }))}
                        onChange={value => setClientId(value)}
                        aria-label={t('clientLabel', { defaultValue: 'Client' })}
                      />
                    )}
                  </div>
                  <div>
                    <div className="invoices-detail-label">
                      {t('projectLabel', { defaultValue: 'Project / Description' })}
                    </div>
                    <Input
                      value={projectName}
                      maxLength={255}
                      onChange={event => setProjectName(event.target.value)}
                      placeholder={t('projectPlaceholder', {
                        defaultValue: 'Name the project or what this quote is for',
                      })}
                      aria-label={t('projectLabel', { defaultValue: 'Project / Description' })}
                    />
                  </div>
                </Flex>
              </Card>

              <Card
                size="small"
                className="invoices-line-items"
                title={t('quoteItems', { defaultValue: 'Quote Items' })}
                extra={
                  <Button icon={<PlusOutlined />} onClick={addLine}>
                    {t('addItem', { defaultValue: 'Add Item' })}
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
                <RichTextField
                  value={notes}
                  onChange={html => setNotes(html)}
                  placeholder={t('quoteNotesPlaceholder', {
                    defaultValue: 'Add validity terms, thank you message, or any additional notes...',
                  })}
                  ariaLabel={t('quoteNotesPlaceholder', {
                    defaultValue: 'Add validity terms, thank you message, or any additional notes...',
                  })}
                  tone="internal"
                  toolbar="basic"
                />
              </Card>
            </Flex>
          </div>

          <div className="invoices-column-side">
            <Flex vertical gap={16}>
              <Card size="small" title={t('quoteSettings', { defaultValue: 'Quote Settings' })}>
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
                      {t('validUntilLabel', { defaultValue: 'Valid Until' })} (
                      {t('optional', { defaultValue: 'Optional' })})
                    </div>
                    <DatePicker
                      style={{ width: '100%' }}
                      value={validUntil}
                      onChange={setValidUntil}
                      placeholder={t('selectValidUntilPlaceholder', {
                        defaultValue: 'Select valid until date',
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
      </Modal>

      <QuotePreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        quote={previewQuote}
      />
    </>
  );
};

export default CreateQuoteModal;
