import React from 'react';
import { Card, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  CloudUploadOutlined,
  ProjectOutlined,
  AppstoreOutlined,
  BranchesOutlined,
} from '@ant-design/icons';
import './import-export-settings.css';
import ImportSourceModal from './ImportSourceModal';

// Custom Asana icon (3 dots in a triangle)
const AsanaIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="17.5" r="2.5" fill="#FC636B" />
    <circle cx="6.5" cy="10.5" r="2.5" fill="#FC636B" />
    <circle cx="17.5" cy="10.5" r="2.5" fill="#FC636B" />
  </svg>
);

type ImportSource = { key: string; icon: React.ReactNode; label: string };

const importSources: ImportSource[] = [
  { key: 'asana', icon: <AsanaIcon />, label: 'Asana' },
  { key: 'jira-software', icon: <BranchesOutlined style={{ color: '#0052CC' }} />, label: 'Jira' },
  { key: 'trello', icon: <ProjectOutlined style={{ color: '#0079BF' }} />, label: 'Trello' },
  { key: 'monday', icon: <AppstoreOutlined style={{ color: '#F6C34E' }} />, label: 'Monday.com' },
];

const csvSource: ImportSource = {
  key: 'csv',
  icon: <CloudUploadOutlined />,
  label: 'CSV',
};

export const ImportExportSettings: React.FC = () => {
  const { t } = useTranslation('settings/import-export');
  const [modalOpen, setModalOpen] = React.useState(false);
  const [selectedSource, setSelectedSource] = React.useState<ImportSource | null>(null);

  const handleSourceClick = (source: ImportSource) => {
    setSelectedSource(source);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedSource(null);
  };

  return (
    <div className="import-export-settings import-export-modal-content-wrapper">
      <Typography.Title level={2} className="import-header-title">
        {t('importHeader', { defaultValue: 'Create a project by importing tasks' })}
      </Typography.Title>
      <Typography.Paragraph className="import-header-subtitle">
        {t('importSubHeader', {
          defaultValue: 'Import from Asana, Jira, Trello, Monday.com, or CSV.',
        })}
      </Typography.Paragraph>
      <Typography.Title level={4} className="section-title">
        {t('importFrom', { defaultValue: 'Choose your source' })}
      </Typography.Title>
      <div className="import-source-grid">
        {importSources.map(source => (
          <div
            className="import-source-card"
            key={source.key}
            role="button"
            tabIndex={0}
            onClick={() => handleSourceClick(source)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSourceClick(source);
              }
            }}
          >
            <div className="import-source-content">
              <div className="import-source-icon">{source.icon}</div>
              <span className="import-source-label">{source.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Can't find your app? section */}
      <div className="cant-find-app-section mt-10">
        <Card className="cant-find-app-card" bordered={false}>
          <Typography.Title level={5} className="mb-1">
            {t('cantFindAppTitle', { defaultValue: "Can't find your app?" })}
          </Typography.Title>
          <Typography.Text type="secondary" className="mb-4 d-block">
            {t('cantFindAppDesc', {
              defaultValue:
                "If you don't see your app here, select CSV to use any CSV file to import your data.",
            })}
          </Typography.Text>
          <div
            className="csv-dropzone"
            role="button"
            tabIndex={0}
            onClick={() => handleSourceClick(csvSource)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSourceClick(csvSource);
              }
            }}
          >
            <div className="csv-dropzone-icon">
              <CloudUploadOutlined />
            </div>
            <Typography.Text className="csv-dropzone-title">
              {t('selectCsv', { defaultValue: 'Select a CSV file to import' })}
            </Typography.Text>
            <Typography.Text type="secondary" className="csv-dropzone-helper">
              {t('dragCsv', { defaultValue: 'or Drag and Drop here' })}
            </Typography.Text>
          </div>
        </Card>
      </div>
      <ImportSourceModal open={modalOpen} onClose={handleModalClose} source={selectedSource} />
    </div>
  );
};

export default ImportExportSettings;
