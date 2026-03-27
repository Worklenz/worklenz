import React from 'react';
import { Button, Collapse, InfoCircleOutlined, Input, Select, Tooltip, Typography, Upload } from '@/shared/antd-imports';

interface CsvSetupStepsContentProps {
  step: number;
  t: (key: string, defaultValueOrOptions?: any, options?: any) => string;
  themeToken: any;
  uploadedCsvFileRef: React.MutableRefObject<File | null>;
  parseCsvData: (text: string) => void;
  encoding: string;
  setEncoding: React.Dispatch<React.SetStateAction<string>>;
  delimiter: string;
  setDelimiter: React.Dispatch<React.SetStateAction<string>>;
  csvSettingsOpen: boolean;
  setCsvSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  configOpen: boolean;
  setConfigOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sourceLabel: string;
  spaceType: string;
  setSpaceType: React.Dispatch<React.SetStateAction<string>>;
  spaceTemplate: string;
  setSpaceTemplate: React.Dispatch<React.SetStateAction<string>>;
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
  configOpen,
  setConfigOpen,
  sourceLabel,
  spaceType,
  setSpaceType,
  spaceTemplate,
  setSpaceTemplate,
  spaceName,
  setSpaceName,
}) => {
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
          <a href="#" style={{ color: themeToken.colorPrimary }}>
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
          accept=".csv"
          showUploadList={false}
          beforeUpload={file => {
            uploadedCsvFileRef.current = file;
            const reader = new FileReader();
            reader.onload = e => {
              const text = e.target?.result as string;
              parseCsvData(text || '');
            };
            reader.readAsText(file, encoding);
            return false;
          }}
        >
          <Button type="primary">{t('importStep.uploadCsvCta', { defaultValue: 'Upload CSV file' })}</Button>
        </Upload.Dragger>
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
                    parseCsvData((e.target?.result as string) || '');
                  };
                  reader.readAsText(file, value);
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
        <Collapse
          ghost
          activeKey={configOpen ? ['config'] : []}
          onChange={keys => setConfigOpen(keys.includes('config'))}
        >
          <Collapse.Panel
            header={
              <span style={{ color: themeToken.colorPrimary }}>
                {t('importStep.configurationUploadTitle', {
                  defaultValue: 'Upload a configuration file (optional)',
                })}
              </span>
            }
            key="config"
            style={{ color: themeToken.colorText, background: 'transparent' }}
          >
            <Typography.Paragraph style={{ color: themeToken.colorTextSecondary, marginBottom: 8 }}>
              {t('importStep.configurationUploadHelp', {
                defaultValue:
                  'Adding a configuration file will bring in preferences selected in a previous import such as mapped fields and users.',
              })}{' '}
              <a href="#" style={{ color: themeToken.colorPrimary }}>
                {t('importStep.configurationUploadDocs', {
                  defaultValue: 'Learn about using configuration files',
                })}
              </a>
            </Typography.Paragraph>
            <Upload disabled>
              <Button disabled>
                {t('importStep.configurationUploadCta', { defaultValue: 'Upload file' })}
              </Button>
            </Upload>
          </Collapse.Panel>
        </Collapse>
      </>
    );
  }

  if (step === 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'row', gap: 48, minHeight: 420 }}>
        <div style={{ flex: 1, maxWidth: 420 }}>
          <Typography.Title level={3} style={{ color: '#fff', marginBottom: 8 }}>
            Set up a space in Worklenz
          </Typography.Title>
          <Typography.Paragraph style={{ color: '#b0b0b0', marginBottom: 16 }}>
            Your teamâ€™s data from <b>{sourceLabel || 'your app'}</b> will be imported into this
            space. Check if youâ€™re selecting the right Worklenz space, template, and space type as
            these options canâ€™t be modified later.
          </Typography.Paragraph>
          <div style={{ color: '#f87171', fontSize: 13, marginBottom: 20 }}>All fields are required</div>

          <div style={{ marginBottom: 20 }}>
            <Typography.Text style={{ color: '#fff', fontWeight: 500 }}>Worklenz space</Typography.Text>
            <Select
              style={{ width: '100%', marginTop: 6 }}
              value={spaceType}
              onChange={setSpaceType}
              styles={{ popup: { root: { background: '#23272f', color: '#fff' } } }}
              optionLabelProp="label"
            >
              <Select.Option value="software" label="Software space">
                <span style={{ color: '#fff' }}>
                  &lt;/&gt; Software space{' '}
                  <span
                    style={{
                      background: '#0052CC',
                      color: '#fff',
                      borderRadius: 4,
                      fontSize: 12,
                      padding: '2px 8px',
                      marginLeft: 8,
                    }}
                  >
                    RECOMMENDED
                  </span>
                </span>
              </Select.Option>
              <Select.Option value="business" label="Business space">
                <span style={{ color: '#fff' }}>Business space</span>
              </Select.Option>
            </Select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <Typography.Text style={{ color: '#fff', fontWeight: 500 }}>Template</Typography.Text>
            <Select
              style={{ width: '100%', marginTop: 6 }}
              value={spaceTemplate}
              onChange={setSpaceTemplate}
              styles={{ popup: { root: { background: '#23272f', color: '#fff' } } }}
              optionLabelProp="label"
            >
              <Select.Option value="scrum" label="Scrum">
                <span role="img" aria-label="Scrum" style={{ marginRight: 8 }}>
                  ðŸ‰
                </span>
                Scrum
              </Select.Option>
              <Select.Option value="kanban" label="Kanban">
                <span role="img" aria-label="Kanban" style={{ marginRight: 8 }}>
                  ðŸ—‚ï¸
                </span>
                Kanban
              </Select.Option>
            </Select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <Typography.Text style={{ color: '#fff', fontWeight: 500 }}>Space name</Typography.Text>
            <Input
              style={{
                width: '100%',
                marginTop: 6,
                background: '#18181a',
                color: '#fff',
                border: '1px solid #333',
              }}
              placeholder={t('importStep.spaceNamePlaceholder', 'Project name')}
              value={spaceName}
              onChange={e => setSpaceName(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <a style={{ color: '#4096ff', fontSize: 14 }} href="#">
              &gt; Show more
            </a>
          </div>
        </div>

        <div style={{ width: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              width: 320,
              height: 180,
              background: '#18181a',
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 16px 0 #b3c6e6',
            }}
          >
            <svg width="220" height="120" viewBox="0 0 220 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="0" width="220" height="120" rx="12" fill="#23272f" />
              <rect x="16" y="20" width="36" height="80" rx="4" fill="#333" />
              <rect x="60" y="20" width="36" height="80" rx="4" fill="#333" />
              <rect x="104" y="20" width="36" height="80" rx="4" fill="#333" />
              <rect x="148" y="20" width="36" height="80" rx="4" fill="#333" />
              <rect x="192" y="20" width="12" height="80" rx="4" fill="#23272f" />
              <rect x="20" y="28" width="28" height="12" rx="2" fill="#23272f" />
              <rect x="64" y="28" width="28" height="12" rx="2" fill="#23272f" />
              <rect x="108" y="28" width="28" height="12" rx="2" fill="#23272f" />
              <rect x="152" y="28" width="28" height="12" rx="2" fill="#23272f" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
