import React from 'react';
import {
  Button,
  Collapse,
  InfoCircleOutlined,
  Input,
  Select,
  Tooltip,
  Typography,
  Upload,
  message as antdMessage,
} from '@/shared/antd-imports';
import { decodeBuffer } from '../utils';

interface CsvSetupStepsContentProps {
  step: number;
  t: (key: string, defaultValueOrOptions?: any, options?: any) => string;
  themeToken: any;
  uploadedCsvFileRef: React.MutableRefObject<File | null>;
  parseCsvData: (text: string) => { columnsCount: number; rowsCount: number };
  encoding: string;
  setEncoding: React.Dispatch<React.SetStateAction<string>>;
  delimiter: string;
  setDelimiter: React.Dispatch<React.SetStateAction<string>>;
  csvSettingsOpen: boolean;
  setCsvSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sourceLabel: string;
  spaceName: string;
  setSpaceName: React.Dispatch<React.SetStateAction<string>>;
}

export const CsvSetupStepsContent: React.FC<CsvSetupStepsContentProps> = ({
  step,
  t,
  themeToken,
  uploadedCsvFileRef,
  parseCsvData,
  encoding,
  setEncoding,
  delimiter,
  setDelimiter,
  csvSettingsOpen,
  setCsvSettingsOpen,
  sourceLabel,
  spaceName,
  setSpaceName,
}) => {
  const [uploadedFileName, setUploadedFileName] = React.useState('');
  const [uploadedSummary, setUploadedSummary] = React.useState<{
    columnsCount: number;
    rowsCount: number;
  } | null>(null);

  if (step === 0) {
    return (
      <>
        <Typography.Title level={3} style={{ marginBottom: 16, color: themeToken.colorText }}>
          {t('importStep.uploadCsvTitle', { defaultValue: 'Upload a CSV file' })}
        </Typography.Title>
        <Typography.Paragraph
          type="secondary"
          style={{ marginBottom: 24, color: themeToken.colorTextSecondary }}
        >
          {t('importStep.uploadCsvHelp', {
            defaultValue:
              'Start by finding the Download or Export option in your app and export a CSV file.',
          })}
          <br />
          <a
            href="https://worklenz.com/blog/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: themeToken.colorPrimary }}
          >
            {t('importStep.structureCsv', { defaultValue: 'Structure the CSV' })}
          </a>{' '}
          {t('importStep.structureCsvSuffix', {
            defaultValue: 'to ensure the data is in the right format and upload it to begin.',
          })}
        </Typography.Paragraph>
        <Upload.Dragger
          style={{
            marginBottom: 24,
            background: themeToken.colorBgContainer,
            border: `1px dashed ${themeToken.colorBorder}`,
            borderRadius: themeToken.borderRadiusLG,
          }}
          accept=".csv,.tsv,.txt"
          showUploadList={false}
          beforeUpload={file => {
            const allowed = ['text/csv', 'text/plain', 'text/tab-separated-values', 'application/csv', 'application/vnd.ms-excel'];
            const ext = (file.name || '').toLowerCase().split('.').pop();
            const allowedExt = ['csv', 'tsv', 'txt'];
            if (!allowed.includes(file.type) && !allowedExt.includes(ext || '')) {
              antdMessage.error(
                t('importStep.csvInvalidType', {
                  defaultValue: 'Please upload a CSV file. Files like PDFs or images are not supported.',
                })
              );
              return false;
            }
            uploadedCsvFileRef.current = file;
            setUploadedFileName(file.name || '');
            const reader = new FileReader();
            reader.onload = e => {
              try {
                const buffer = e.target?.result as ArrayBuffer;
                const text = decodeBuffer(buffer, encoding);
                const summary = parseCsvData(text);
                setUploadedSummary(summary);
                antdMessage.success(
                  t('importStep.csvLoaded', {
                    defaultValue: 'CSV loaded: {{rows}} rows and {{columns}} columns.',
                    rows: summary.rowsCount,
                    columns: summary.columnsCount,
                  })
                );
              } catch {
                antdMessage.error(
                  t('importStep.csvReadError', {
                    defaultValue: 'We could not read this CSV file. Please try another file.',
                  })
                );
              }
            };
            reader.onerror = () => {
              antdMessage.error(
                t('importStep.csvReadError', {
                  defaultValue: 'We could not read this CSV file. Please try another file.',
                })
              );
            };
            reader.readAsArrayBuffer(file);
            return false;
          }}
        >
          <Button type="primary">{t('importStep.uploadCsvCta', { defaultValue: 'Upload CSV file' })}</Button>
        </Upload.Dragger>
        {!!uploadedFileName && (
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            {t('importStep.csvLoadedFile', {
              defaultValue: 'Loaded file: {{fileName}}',
              fileName: uploadedFileName,
            })}
            {uploadedSummary
              ? ` (${uploadedSummary.rowsCount} ${t('importStep.rows', {
                defaultValue: 'rows',
              })}, ${uploadedSummary.columnsCount} ${t('importStep.columns', {
                defaultValue: 'columns',
              })})`
              : ''}
          </Typography.Text>
        )}
        <Collapse
          ghost
          activeKey={csvSettingsOpen ? ['csv'] : []}
          onChange={keys => setCsvSettingsOpen(keys.includes('csv'))}
          style={{ marginBottom: 8 }}
        >
          <Collapse.Panel
            header={
              <span style={{ color: themeToken.colorPrimary }}>
                {t('importStep.csvSettings', { defaultValue: 'CSV file settings' })}
              </span>
            }
            key="csv"
            style={{ color: themeToken.colorText, background: 'transparent' }}
          >
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 8 }}>
              <span>{t('importStep.fileEncoding', { defaultValue: 'File encoding' })}</span>
              <Tooltip
                title={t('importStep.fileEncodingHelp', {
                  defaultValue: 'The character encoding of your CSV file.',
                })}
              >
                <InfoCircleOutlined style={{ color: themeToken.colorPrimary }} />
              </Tooltip>
              <Select
                value={encoding}
                onChange={value => {
                  setEncoding(value);
                  const file = uploadedCsvFileRef.current;
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = e => {
                    try {
                      const buffer = e.target?.result as ArrayBuffer;
                      const text = decodeBuffer(buffer, value);
                      const summary = parseCsvData(text);
                      setUploadedSummary(summary);
                    } catch {
                      // silently ignore re-parse errors on encoding change
                    }
                  };
                  reader.readAsArrayBuffer(file);
                }}
                style={{ width: 120 }}
                options={[
                  { value: 'US-ASCII', label: 'US-ASCII' },
                  { value: 'ISO-8859-1', label: 'ISO-8859-1' },
                  { value: 'UTF-8', label: 'UTF-8' },
                  { value: 'UTF-16BE', label: 'UTF-16BE' },
                  { value: 'UTF-16LE', label: 'UTF-16LE' },
                  { value: 'UTF-16', label: 'UTF-16' },
                ]}
              />
              <span style={{ marginLeft: 32 }}>
                {t('importStep.delimiter', { defaultValue: 'Delimiter' })}
              </span>
              <Tooltip
                title={t('importStep.delimiterHelp', {
                  defaultValue: 'The character that separates values in your CSV file.',
                })}
              >
                <InfoCircleOutlined style={{ color: themeToken.colorPrimary }} />
              </Tooltip>
              <Input
                value={delimiter}
                onChange={e => setDelimiter(e.target.value)}
                style={{ width: 80 }}
                placeholder=","
              />
            </div>
          </Collapse.Panel>
        </Collapse>
      </>
    );
  }

  if (step === 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'row', gap: 48, minHeight: 420 }}>
        <div style={{ flex: 1, maxWidth: 420 }}>
          <Typography.Title level={3} style={{ color: themeToken.colorText, marginBottom: 8 }}>
            {t('importStep.setupProjectTitle', { defaultValue: 'Set up a project in Worklenz' })}
          </Typography.Title>
          <Typography.Paragraph style={{ color: themeToken.colorTextSecondary, marginBottom: 16 }}>
            {t('importStep.setupProjectDesc', {
              defaultValue:
                "Your team's data from {{source}} will be imported into a new project. Review the project name before continuing.",
              source: sourceLabel || t('importStep.yourApp', { defaultValue: 'your app' }),
            })}
          </Typography.Paragraph>
          <div style={{ color: themeToken.colorError, fontSize: 13, marginBottom: 20 }}>
            {t('importStep.projectNameRequired', { defaultValue: 'Project name is required' })}
          </div>

          <div style={{ marginBottom: 20 }}>
            <Typography.Text style={{ color: themeToken.colorText, fontWeight: 500 }}>
              {t('importStep.projectNameLabel', { defaultValue: 'Project name' })}
            </Typography.Text>
            <Input
              style={{
                width: '100%',
                marginTop: 6,
                background: themeToken.colorBgContainer,
                color: themeToken.colorText,
                border: `1px solid ${themeToken.colorBorder}`,
              }}
              placeholder={t('importStep.spaceNamePlaceholder', { defaultValue: 'Project name' })}
              value={spaceName}
              onChange={e => setSpaceName(e.target.value)}
            />
          </div>

          <Typography.Paragraph style={{ color: themeToken.colorTextSecondary, marginBottom: 8 }}>
            {t('importStep.projectDefaultsInfo', {
              defaultValue: 'Default project settings will be applied automatically during import.',
            })}
          </Typography.Paragraph>
        </div>

        <div style={{ width: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              width: 320,
              height: 180,
              background: themeToken.colorBgContainer,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: themeToken.boxShadowSecondary,
            }}
          >
            <svg width="220" height="120" viewBox="0 0 220 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="0" width="220" height="120" rx="12" fill={themeToken.colorBgLayout} />
              <rect x="16" y="20" width="36" height="80" rx="4" fill={themeToken.colorFillTertiary} />
              <rect x="60" y="20" width="36" height="80" rx="4" fill={themeToken.colorFillTertiary} />
              <rect x="104" y="20" width="36" height="80" rx="4" fill={themeToken.colorFillTertiary} />
              <rect x="148" y="20" width="36" height="80" rx="4" fill={themeToken.colorFillTertiary} />
              <rect x="192" y="20" width="12" height="80" rx="4" fill={themeToken.colorBgLayout} />
              <rect x="20" y="28" width="28" height="12" rx="2" fill={themeToken.colorBgContainer} />
              <rect x="64" y="28" width="28" height="12" rx="2" fill={themeToken.colorBgContainer} />
              <rect x="108" y="28" width="28" height="12" rx="2" fill={themeToken.colorBgContainer} />
              <rect x="152" y="28" width="28" height="12" rx="2" fill={themeToken.colorBgContainer} />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
