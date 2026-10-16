import React from 'react';
import { Tooltip } from '@/shared/antd-imports';

interface ColumnTitleProps {
  label: React.ReactNode;
  /** One short line saying what the column shows. */
  help: string;
}

/** A table column header with a one-line hover/focus explanation. */
export const ColumnTitle = ({ label, help }: ColumnTitleProps) => (
  <Tooltip title={help} trigger={['hover', 'focus']}>
    <span tabIndex={0}>{label}</span>
  </Tooltip>
);
