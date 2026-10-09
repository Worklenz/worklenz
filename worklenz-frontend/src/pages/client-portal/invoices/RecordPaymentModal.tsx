import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Flex, InputNumber, Modal, Segmented, Typography, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { useRecordInvoicePaymentMutation } from '../../../api/client-portal/client-portal-api';
import type { ClientPortalInvoice } from '../../../api/client-portal/client-portal-api';
import { getCurrencySymbol } from '../../../shared/currencies';
import {
  clampPaidAmount,
  formatMoney,
  resolvePaidAmount,
  type InvoicePaymentStatus,
} from './invoices-list-helpers';
import './invoices.css';

const MAX_PROOF_SIZE_BYTES = 10 * 1024 * 1024;

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export type RecordPaymentTarget = Pick<
  ClientPortalInvoice,
  'id' | 'invoiceNumber' | 'amount' | 'currency' | 'paidAmount' | 'paymentStatus'
>;

interface RecordPaymentModalProps {
  open: boolean;
  invoice: RecordPaymentTarget | null;
  /** The status the person picked before this opened (the row dropdown), if any. */
  initialStatus?: InvoicePaymentStatus;
  onClose: () => void;
  onSaved?: () => void;
}

/** Records a payment (Paid or Partially Paid) with an optional proof file. */
export const RecordPaymentModal = ({
  open,
  invoice,
  initialStatus,
  onClose,
  onSaved,
}: RecordPaymentModalProps) => {
  const { t } = useTranslation('client-portal-invoices');
  const [recordPayment, { isLoading }] = useRecordInvoicePaymentMutation();

  const [paymentStatus, setPaymentStatus] = useState<Exclude<InvoicePaymentStatus, 'unpaid'>>('paid');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [proofList, setProofList] = useState<UploadFile[]>([]);

  useEffect(() => {
    if (!open || !invoice) return;
    const status = initialStatus && initialStatus !== 'unpaid' ? initialStatus : 'paid';
    setPaymentStatus(status);
    setPaidAmount(resolvePaidAmount(status, invoice.amount, invoice.paidAmount));
    setProofList([]);
  }, [open, invoice, initialStatus]);

  if (!invoice) return null;

  const currency = invoice.currency;

  const handleStatusChange = (value: string | number) => {
    const status = value as Exclude<InvoicePaymentStatus, 'unpaid'>;
    setPaymentStatus(status);
    setPaidAmount(resolvePaidAmount(status, invoice.amount, invoice.paidAmount));
  };

  const handleSave = async () => {
    const amount = resolvePaidAmount(paymentStatus, invoice.amount, paidAmount);
    try {
      const file = proofList[0]?.originFileObj;
      await recordPayment({
        id: invoice.id,
        paymentStatus,
        paidAmount: amount,
        proof: file
          ? { fileName: file.name, fileType: file.type, fileData: await readAsDataUrl(file) }
          : null,
      }).unwrap();
      message.success(
        t('paymentRecordedSuccess', {
          number: invoice.invoiceNumber,
          defaultValue: '{{number}} payment recorded.',
        })
      );
      onSaved?.();
      onClose();
    } catch (error) {
      const serverMessage = (error as { data?: { message?: string } })?.data?.message;
      message.error(
        serverMessage || t('paymentRecordedError', { defaultValue: 'Failed to record the payment.' })
      );
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      rootClassName="invoices-modal"
      width={440}
      destroyOnHidden
      title={t('recordPaymentTitle', { defaultValue: 'Record Payment' })}
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button size="small" onClick={onClose}>
            {t('cancelButton', { defaultValue: 'Cancel' })}
          </Button>
          <Button type="primary" size="small" loading={isLoading} onClick={handleSave}>
            {t('saveButton', { defaultValue: 'Save' })}
          </Button>
        </Flex>
      }
    >
      <Flex vertical gap={16}>
        <Typography.Text type="secondary">
          {t('recordPaymentIntro', {
            number: invoice.invoiceNumber,
            total: formatMoney(invoice.amount, currency),
            defaultValue: 'Record a payment for {{number}}. Invoice total {{total}}.',
          })}
        </Typography.Text>

        <div>
          <div className="invoices-detail-label">
            {t('paymentStatusColumn', { defaultValue: 'Payment Status' })}
          </div>
          <Segmented
            size="small"
            value={paymentStatus}
            onChange={handleStatusChange}
            options={[
              { value: 'paid', label: t('paymentStatusPaid', { defaultValue: 'Paid' }) },
              {
                value: 'partially_paid',
                label: t('paymentStatusPartiallyPaid', { defaultValue: 'Partially Paid' }),
              },
            ]}
          />
        </div>

        <div>
          <div className="invoices-detail-label">
            {t('paidAmountColumn', { defaultValue: 'Paid Amount' })}
          </div>
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            max={invoice.amount}
            step={0.01}
            precision={2}
            disabled={paymentStatus === 'paid'}
            value={paidAmount}
            prefix={getCurrencySymbol(currency)}
            aria-label={t('paidAmountColumn', { defaultValue: 'Paid Amount' })}
            onChange={value => setPaidAmount(clampPaidAmount(value, invoice.amount))}
          />
        </div>

        <div>
          <div className="invoices-detail-label">
            {t('paymentProofOptional', { defaultValue: 'Payment Proof (Optional)' })}
          </div>
          <Upload
            accept="image/*,.pdf"
            maxCount={1}
            fileList={proofList}
            beforeUpload={file => {
              if (file.size > MAX_PROOF_SIZE_BYTES) {
                message.error(
                  t('paymentProofTooLarge', { defaultValue: 'The file must be 10 MB or smaller.' })
                );
                return Upload.LIST_IGNORE;
              }
              // Kept in state and sent with Save, never uploaded on its own.
              return false;
            }}
            onChange={({ fileList }) => setProofList(fileList.slice(-1))}
          >
            <Button size="small" icon={<UploadOutlined />}>
              {t('uploadFileButton', { defaultValue: 'Upload File' })}
            </Button>
          </Upload>
        </div>
      </Flex>
    </Modal>
  );
};

export default RecordPaymentModal;
