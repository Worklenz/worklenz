import React from 'react';
import { Button, Dropdown } from '@/shared/antd-imports';
import { ExportOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { FILTER_PILL_BUTTON_STYLE } from '@/components/common/filters/MultiSelectFilterPill';

export type AnalyticsExportFormat = 'csv' | 'pdf' | 'png' | 'svg' | 'excel';

/** Formats most analytics reports support (Excel is Velocity-only). */
export const DEFAULT_ANALYTICS_EXPORT_FORMATS: AnalyticsExportFormat[] = [
  'csv',
  'pdf',
  'png',
  'svg',
];

interface AnalyticsExportMenuProps {
  onExport: (format: AnalyticsExportFormat) => void;
  disabled?: boolean;
  loading?: boolean;
  /** When set, only these formats are shown (defaults to CSV/PDF/PNG/SVG). */
  formats?: AnalyticsExportFormat[];
}

export const AnalyticsExportMenu: React.FC<AnalyticsExportMenuProps> = ({
  onExport,
  disabled,
  loading,
  formats = DEFAULT_ANALYTICS_EXPORT_FORMATS,
}) => {
  const { t } = useTranslation('reporting-analytics');

  const allItems: { key: AnalyticsExportFormat; label: string }[] = [
    { key: 'csv', label: t('exportCsv', { defaultValue: 'CSV' }) },
    { key: 'excel', label: t('exportExcel', { defaultValue: 'Excel' }) },
    { key: 'pdf', label: t('exportPdf', { defaultValue: 'PDF' }) },
    { key: 'png', label: t('exportPng', { defaultValue: 'PNG' }) },
    { key: 'svg', label: t('exportSvg', { defaultValue: 'SVG' }) },
  ];

  const items = allItems.filter(item => formats.includes(item.key));

  return (
    <Dropdown
      disabled={disabled || loading}
      menu={{
        items,
        onClick: ({ key }) => {
          // Defer so the dropdown can close before the async export starts;
          // keeps the click gesture available for the file download.
          window.setTimeout(() => onExport(key as AnalyticsExportFormat), 0);
        },
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
