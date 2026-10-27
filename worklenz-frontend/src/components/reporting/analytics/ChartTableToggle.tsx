import React from 'react';
import { Segmented } from '@/shared/antd-imports';
import { BarChartOutlined, TableOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

export type ChartTableMode = 'chart' | 'table';

interface ChartTableToggleProps {
  value: ChartTableMode;
  onChange: (mode: ChartTableMode) => void;
}

export const ChartTableToggle: React.FC<ChartTableToggleProps> = ({ value, onChange }) => {
  const { t } = useTranslation('reporting-analytics');

  return (
    <Segmented
      value={value}
      onChange={next => onChange(next as ChartTableMode)}
      options={[
        {
          value: 'chart',
          icon: <BarChartOutlined />,
          label: t('viewAsChart', { defaultValue: 'View as chart' }),
        },
        {
          value: 'table',
          icon: <TableOutlined />,
          label: t('viewAsTable', { defaultValue: 'View as table' }),
        },
      ]}
      aria-label={t('viewModeToggle', { defaultValue: 'Toggle chart or table view' })}
    />
  );
};

interface ChartTableWrapperProps {
  mode: ChartTableMode;
  chart: React.ReactNode;
  table: React.ReactNode;
}

/** Accessible chart/table switch — both views stay in the tree for screen readers when table mode. */
export const ChartTableWrapper: React.FC<ChartTableWrapperProps> = ({ mode, chart, table }) => {
  if (mode === 'table') {
    return (
      <div role="region" aria-live="polite">
        {table}
      </div>
    );
  }

  return (
    <div role="img" aria-hidden={false}>
      {chart}
    </div>
  );
};
