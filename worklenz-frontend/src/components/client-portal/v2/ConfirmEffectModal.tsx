import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/shared/antd-imports';

interface ConfirmEffectModalProps {
  open: boolean;
  title: React.ReactNode;
  /** Names the consequence, e.g. "3 active client users lose access immediately". */
  children: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  /** Keeps the confirm button off while something still blocks the action (an unpaid invoice, a missing acknowledgement). */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Destructive or access-changing actions confirm by naming their effect (who loses access, what
 * is kept) rather than asking a generic "Are you sure?".
 */
export const ConfirmEffectModal = ({
  open,
  title,
  children,
  confirmLabel,
  danger,
  loading,
  confirmDisabled,
  onConfirm,
  onClose,
}: ConfirmEffectModalProps) => {
  const { t } = useTranslation('client-portal-v2');
  return (
    <Modal
      open={open}
      title={title}
      okText={confirmLabel}
      cancelText={t('cancel', { defaultValue: 'Cancel' })}
      okButtonProps={{ danger, loading, disabled: confirmDisabled }}
      onOk={onConfirm}
      onCancel={onClose}
      maskClosable={!loading}
      width={460}
      destroyOnHidden
    >
      {children}
    </Modal>
  );
};
