import React from 'react';
import { Card, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import './import-export-settings.css';
import ImportSourceModal from './ImportSourceModal';

const JiraIcon = () => (
  <svg width="28" height="28" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="jiraGrad1" x1="98.031%" x2="58.888%" y1=".161%" y2="40.766%">
        <stop offset="18%" stopColor="#0052CC" />
        <stop offset="100%" stopColor="#2684FF" />
      </linearGradient>
      <linearGradient id="jiraGrad2" x1="100.665%" x2="55.402%" y1=".455%" y2="44.727%">
        <stop offset="18%" stopColor="#0052CC" />
        <stop offset="100%" stopColor="#2684FF" />
      </linearGradient>
    </defs>
    <path
      fill="#2684FF"
      d="M244.658 0H121.707a55.5 55.5 0 0 0 55.502 55.502h22.649V77.37c.02 30.625 24.841 55.447 55.466 55.467V10.666C255.324 4.777 250.55 0 244.658 0"
    />
    <path
      fill="url(#jiraGrad1)"
      d="M183.822 61.262H60.872c.019 30.625 24.84 55.447 55.466 55.467h22.649v21.938c.039 30.625 24.877 55.43 55.502 55.43V71.93c0-5.891-4.776-10.667-10.667-10.667"
    />
    <path
      fill="url(#jiraGrad2)"
      d="M122.951 122.489H0c0 30.653 24.85 55.502 55.502 55.502h22.72v21.867c.02 30.597 24.798 55.408 55.396 55.466V133.156c0-5.891-4.776-10.667-10.667-10.667"
    />
  </svg>
);

const AsanaIcon = () => (
  <svg width="28" height="28" viewBox="0 0 256 237" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fill="#F06A6A"
      d="M200.325 125.27c-30.749 0-55.675 24.927-55.675 55.677s24.926 55.677 55.675 55.677S256 211.696 256 180.947c0-30.75-24.926-55.677-55.675-55.677m-144.65.005C24.927 125.275 0 150.197 0 180.947s24.927 55.677 55.675 55.677c30.75 0 55.678-24.928 55.678-55.677c0-30.75-24.928-55.672-55.678-55.672m128-69.6c0 30.75-24.927 55.68-55.674 55.68c-30.75 0-55.676-24.93-55.676-55.68C72.325 24.928 97.25 0 128 0c30.747 0 55.673 24.93 55.673 55.674"
    />
  </svg>
);

const TrelloIcon = () => (
  <svg width="28" height="28" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="trelloGrad" x1="50%" x2="50%" y1="0%" y2="100%">
        <stop offset="0%" stopColor="#0091E6" />
        <stop offset="100%" stopColor="#0079BF" />
      </linearGradient>
    </defs>
    <rect width="256" height="256" fill="url(#trelloGrad)" rx="25" />
    <rect width="78.08" height="112" x="144.64" y="33.28" fill="#FFF" rx="12" />
    <rect width="78.08" height="176" x="33.28" y="33.28" fill="#FFF" rx="12" />
  </svg>
);

const MondayIcon = () => (
  <svg
    className="import-source-icon-wide"
    width="34"
    height="20"
    viewBox="0 0 256 156"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill="#F62B54"
      d="M31.846 153.489a31.97 31.97 0 0 1-27.86-16.167a30.91 30.91 0 0 1 .875-31.823l57.373-90.096A31.99 31.99 0 0 1 90.556.015a31.93 31.93 0 0 1 27.41 16.896c5.349 10.113 4.68 22.28-1.725 31.774L58.904 138.78a31.98 31.98 0 0 1-27.058 14.709"
    />
    <path
      fill="#FFCC00"
      d="M130.256 153.488c-11.572 0-22.22-6.187-27.812-16.13a30.81 30.81 0 0 1 .875-31.737l57.264-89.89A31.94 31.94 0 0 1 188.93.016c11.669.255 22.244 6.782 27.592 16.993a30.81 30.81 0 0 1-2.066 31.92l-57.252 89.889a31.93 31.93 0 0 1-26.948 14.671"
    />
    <ellipse cx="226.466" cy="125.324" fill="#00CA72" rx="29.538" ry="28.918" />
  </svg>
);

type ImportSource = { key: string; icon: React.ReactNode; label: string; order: number };

const importSources: ImportSource[] = [
  { key: 'asana', icon: <AsanaIcon />, label: 'Asana', order: 1 },
  {
    key: 'jira-software',
    icon: <JiraIcon />,
    label: 'Jira',
    order: 0,
  },
  { key: 'trello', icon: <TrelloIcon />, label: 'Trello', order: 2 },
  {
    key: 'monday',
    icon: <MondayIcon />,
    label: 'Monday.com',
    order: 3,
  },
];

const csvSource: ImportSource = {
  key: 'csv',
  icon: (
    <img
      src="/file-types/csv.png"
      alt="CSV"
      style={{ width: 36, height: 36, objectFit: 'contain' }}
    />
  ),
  label: 'CSV',
  order: 99,
};

interface ImportExportSettingsProps {
  showHeader?: boolean;
}

export const ImportExportSettings: React.FC<ImportExportSettingsProps> = ({ showHeader = true }) => {
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
      {showHeader && (
        <>
          <Typography.Title level={2} className="import-header-title">
            {t('importHeader', { defaultValue: 'Create a project by importing tasks' })}
          </Typography.Title>
          <Typography.Paragraph className="import-header-subtitle">
            {t('importSubHeader', {
              defaultValue: 'Import from Asana, Jira, Trello, Monday.com, or CSV.',
            })}
          </Typography.Paragraph>
        </>
      )}
      <Typography.Title level={4} className="section-title">
        {t('importFrom', { defaultValue: 'Choose your source' })}
      </Typography.Title>
      <div className="import-source-grid">
        {[...importSources].sort((a, b) => a.order - b.order).map(source => (
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
              <img src="/file-types/csv.png" alt="CSV file" />
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
