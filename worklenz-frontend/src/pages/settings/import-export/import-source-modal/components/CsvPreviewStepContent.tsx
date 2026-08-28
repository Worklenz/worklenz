import React from 'react';
import { Table, Typography } from '@/shared/antd-imports';

const CSV_PREVIEW_ROW_COUNT = 8;
const CSV_PREVIEW_COLUMN_COUNT = 8;

interface CsvPreviewStepContentProps {
  t: (key: string, defaultValueOrOptions?: any, options?: any) => string;
  themeToken: any;
  uploadedCsvFileRef: React.MutableRefObject<File | null>;
  csvColumns: string[];
  csvRows: Record<string, any>[];
}

export const CsvPreviewStepContent: React.FC<CsvPreviewStepContentProps> = ({
  t,
  themeToken,
  uploadedCsvFileRef,
  csvColumns,
  csvRows,
}) => {
  const fileName = uploadedCsvFileRef.current?.name;

  return (
    <div style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ color: themeToken.colorText, marginBottom: 8 }}>
        {t('importStep.previewCsvTitle', { defaultValue: 'Preview your data' })}
      </Typography.Title>
      <Typography.Paragraph style={{ color: themeToken.colorTextSecondary, marginBottom: 16 }}>
        {t('importStep.previewCsvHelp', {
          defaultValue:
            'This is how your data looks. If something is off, go back and upload a different file.',
        })}
      </Typography.Paragraph>

      {csvColumns.length === 0 || csvRows.length === 0 ? (
        <Typography.Text style={{ color: themeToken.colorTextTertiary }}>
          {t('importStep.previewCsvEmpty', {
            defaultValue: 'No data to preview yet. Go back and upload a CSV file.',
          })}
        </Typography.Text>
      ) : (
        <>
          <Typography.Text
            type="secondary"
            style={{ display: 'block', marginBottom: 8, fontSize: 13 }}
          >
            {fileName
              ? t('importStep.csvPreviewLabelWithFile', {
                  defaultValue: '{{fileName}} — showing first {{rows}} of {{totalRows}} rows',
                  fileName,
                  rows: Math.min(csvRows.length, CSV_PREVIEW_ROW_COUNT),
                  totalRows: csvRows.length,
                })
              : t('importStep.csvPreviewLabel', {
                  defaultValue: 'Preview (first {{rows}} of {{totalRows}} rows)',
                  rows: Math.min(csvRows.length, CSV_PREVIEW_ROW_COUNT),
                  totalRows: csvRows.length,
                })}
          </Typography.Text>
          <Table
            size="small"
            pagination={false}
            scroll={{ x: true }}
            dataSource={csvRows.slice(0, CSV_PREVIEW_ROW_COUNT).map((row, index) => ({
              ...row,
              _previewKey: index,
            }))}
            rowKey="_previewKey"
            columns={csvColumns.slice(0, CSV_PREVIEW_COLUMN_COUNT).map(column => ({
              title: column,
              dataIndex: column,
              key: column,
              ellipsis: true,
              width: 160,
            }))}
          />
          {csvColumns.length > CSV_PREVIEW_COLUMN_COUNT && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('importStep.csvPreviewMoreColumns', {
                defaultValue: '+ {{count}} more columns not shown here',
                count: csvColumns.length - CSV_PREVIEW_COLUMN_COUNT,
              })}
            </Typography.Text>
          )}
        </>
      )}
    </div>
  );
};
