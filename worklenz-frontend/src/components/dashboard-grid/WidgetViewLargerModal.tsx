import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ExpandAltOutlined, Modal, Tooltip } from '@/shared/antd-imports';

export interface ViewLargerButtonProps {
  title: string;
  onClick: () => void;
  i18nNamespace?: string;
  className?: string;
}

/**
 * Icon-only button meant to be placed in a widget's title/top area (e.g. an antd `Card`'s `extra`
 * slot) and hover-revealed via CSS (see `.wl-widget-view-larger` in dashboard-grid.css).
 */
export const ViewLargerButton: React.FC<ViewLargerButtonProps> = ({ title, onClick, i18nNamespace, className }) => {
  const { t } = useTranslation(i18nNamespace);
  const label = t('dashboardGrid.viewLarger', { name: title, defaultValue: 'View {{name}} larger' });
  return (
    <Tooltip title={label}>
      <Button
        type="text"
        size="small"
        icon={<ExpandAltOutlined />}
        onClick={onClick}
        aria-label={label}
        className={['wl-widget-view-larger', className].filter(Boolean).join(' ')}
      />
    </Tooltip>
  );
};

export interface WidgetViewLargerModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/** Re-renders a widget's content larger, in a modal. */
export const WidgetViewLargerModal: React.FC<WidgetViewLargerModalProps> = ({ title, open, onClose, children }) => {
  return (
    <Modal title={title} open={open} onCancel={onClose} footer={null} width={900} destroyOnClose centered>
      <div style={{ height: '70vh', minHeight: 420 }}>{children}</div>
    </Modal>
  );
};
