import React from 'react';
import { Button, Dropdown } from '@/shared/antd-imports';
import { ExportOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { FILTER_PILL_BUTTON_STYLE } from '@/components/common/filters/MultiSelectFilterPill';

export type AnalyticsExportFormat = 'csv' | 'pdf' | 'png' | 'excel';

interface AnalyticsExportMenuProps {
  onExport: (format: AnalyticsExportFormat) => void;
  disabled?: boolean;
  loading?: boolean;
}

export const AnalyticsExportMenu: React.FC<AnalyticsExportMenuProps> = ({
  onExport,
  disabled,
  loading,
}) => {
  const { t } = useTranslation('reporting-analytics');

  return (
    <Dropdown
      disabled={disabled}
      menu={{
        items: [
          { key: 'csv', label: t('exportCsv', { defaultValue: 'CSV' }) },
          { key: 'excel', label: t('exportExcel', { defaultValue: 'Excel' }) },
          { key: 'pdf', label: t('exportPdf', { defaultValue: 'PDF' }) },
          { key: 'png', label: t('exportPng', { defaultValue: 'PNG' }) },
        ],
        onClick: ({ key }) => onExport(key as AnalyticsExportFormat),
      }}
      trigger={['click']}
    >
      <Button
        icon={<ExportOutlined />}
        loading={loading}
        disabled={disabled}
        style={FILTER_PILL_BUTTON_STYLE}
        aria-haspopup="menu"
      >
        {t('export', { defaultValue: 'Export' })}
      </Button>
    </Dropdown>
  );
};
