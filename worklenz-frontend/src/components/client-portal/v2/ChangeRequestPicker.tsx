import { useTranslation } from 'react-i18next';
import { Alert, Card, Select, theme } from '@/shared/antd-imports';
import type { BillableChangeRequest } from '@/types/client-portal/v2';
import { decodeHtmlEntities } from '@/utils/html-entities';

interface ChangeRequestPickerProps {
  /** Approved, In Progress and Completed requests: the only ones a quote or invoice can start from. */
  changeRequests: BillableChangeRequest[];
  isLoading?: boolean;
  value: string | null;
  onChange: (changeRequest: BillableChangeRequest | null) => void;
  /** Which document is being created; an invoice warns when the request has already been invoiced. */
  document: 'quote' | 'invoice';
}

/**
 * "Select Change Request" on the create-quote and create-invoice forms. Leaving it blank creates a
 * standalone document for a client picked by hand.
 */
export const ChangeRequestPicker = ({ changeRequests, isLoading, value, onChange, document }: ChangeRequestPickerProps) => {
  const { t } = useTranslation('client-portal-v2');
  const { token } = theme.useToken();
  const selected = changeRequests.find(item => item.id === value);

  return (
    <Card size="small" title={t('changeRequestPicker.title', { defaultValue: 'Select Change Request' })}>
      <Select<string>
        showSearch
        allowClear
        style={{ width: '100%' }}
        loading={isLoading}
        value={value ?? undefined}
        optionFilterProp="label"
        placeholder={t('changeRequestPicker.placeholder', { defaultValue: 'Search by request number or title' })}
        notFoundContent={t('changeRequestPicker.none', { defaultValue: 'No billable change requests found' })}
        aria-label={t('changeRequestPicker.title', { defaultValue: 'Select Change Request' })}
        options={changeRequests.map(item => ({
          value: item.id,
          label: t('changeRequestPicker.option', {
            number: item.cr_no,
            title: decodeHtmlEntities(item.title),
            defaultValue: '{{number}} - {{title}}',
          }),
        }))}
        onChange={next => onChange(changeRequests.find(item => item.id === next) ?? null)}
      />
      <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 6 }}>
        {document === 'quote'
          ? t('changeRequestPicker.helpQuote', {
              defaultValue:
                'Only approved, in-progress and completed change requests can be quoted. Leave blank to create a standalone quote.',
            })
          : t('changeRequestPicker.helpInvoice', {
              defaultValue:
                'Only approved, in-progress and completed change requests can be invoiced. Leave blank to create a standalone invoice.',
            })}
      </div>
      {document === 'invoice' && selected && selected.existing_invoice_count > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 10 }}
          message={t('changeRequestPicker.alreadyInvoiced', {
            number: selected.cr_no,
            count: selected.existing_invoice_count,
            defaultValue: '{{number}} already has {{count}} invoice(s). You can still create another.',
          })}
        />
      )}
    </Card>
  );
};
