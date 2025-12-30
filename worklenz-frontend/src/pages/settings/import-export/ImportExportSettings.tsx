import React, { useState, useMemo } from 'react';
import { Input } from 'antd';
import { Card, Typography, Alert, Row, Col } from 'antd';
import { useTranslation } from 'react-i18next';
import { GitHubIcon } from '@/components/settings/integrations/IntegrationIcons';
import {
  CloudUploadOutlined,
  TableOutlined,
  ProjectOutlined,
  AppstoreOutlined,
  GitlabOutlined,
  FileTextOutlined,
  ClusterOutlined,
  ApartmentOutlined,
  NodeIndexOutlined,
  CheckSquareOutlined,
  ThunderboltOutlined,
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

const importSources = [
  { key: 'asana', icon: <AsanaIcon />, label: 'Asana' },
  { key: 'monday', icon: <AppstoreOutlined style={{ color: '#FFD02F' }} />, label: 'monday' },
  { key: 'clickup', icon: <CloudUploadOutlined style={{ color: '#7B68EE' }} />, label: 'ClickUp' },
  { key: 'trello', icon: <ProjectOutlined style={{ color: '#0079BF' }} />, label: 'Trello' },
  {
    key: 'azuredevops',
    icon: <ClusterOutlined style={{ color: '#0078D4' }} />,
    label: 'Azure DevOps',
  },
  { key: 'github', icon: <GitHubIcon />, label: 'GitHub' },
  { key: 'gitlab', icon: <GitlabOutlined style={{ color: '#FC6D26' }} />, label: 'GitLab' },
  { key: 'smartsheet', icon: <TableOutlined style={{ color: '#1A82E2' }} />, label: 'Smartsheet' },
  {
    key: 'youtrack',
    icon: <ApartmentOutlined style={{ color: '#000' }} />,
    label: 'Jetbrains YouTrack',
  },
  { key: 'notion', icon: <FileTextOutlined style={{ color: '#000' }} />, label: 'Notion' },
  { key: 'linear', icon: <NodeIndexOutlined style={{ color: '#000' }} />, label: 'Linear' },
  { key: 'wrike', icon: <CheckSquareOutlined style={{ color: '#22B573' }} />, label: 'Wrike' },
  {
    key: 'airtable',
    icon: <ThunderboltOutlined style={{ color: '#FFB300' }} />,
    label: 'Airtable',
  },
  {
    key: 'jira-software',
    icon: <BranchesOutlined style={{ color: '#0052CC' }} />,
    label: 'Jira (software space)',
  },
  {
    key: 'jira-business',
    icon: <BranchesOutlined style={{ color: '#2684FF' }} />,
    label: 'Jira (business space)',
  },
];

export const ImportExportSettings: React.FC = () => {
  const { t } = useTranslation('settings/import-export');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<null | (typeof importSources)[0]>(null);

  const filteredSources = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return importSources;
    return importSources.filter(source => source.label.toLowerCase().includes(s));
  }, [search]);

  const handleSourceClick = (source: (typeof importSources)[0]) => {
    setSelectedSource(source);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedSource(null);
  };

  return (
    <div className="import-export-settings import-export-modal-content-wrapper">
      <Typography.Title level={2} className="mb-8">
        {t('importHeader', 'Import data into Worklenz')}
      </Typography.Title>
      {/* Search apps input */}
      <Input
        allowClear
        prefix={
          <span className="anticon anticon-search import-search-icon">
            <svg width="1em" height="1em" fill="currentColor" viewBox="0 0 1024 1024">
              <path d="M909.6 834.8L723.2 648.4c54.4-70.4 87.2-158.4 87.2-254.4C810.4 177.6 632.8 0 416 0S21.6 177.6 21.6 394.4 199.2 788.8 416 788.8c96 0 184-32.8 254.4-87.2l186.4 186.4c12.8 12.8 33.6 12.8 46.4 0 12.8-12.8 12.8-33.6 0-46.4zM416 704c-171.2 0-310.4-139.2-310.4-310.4S244.8 83.2 416 83.2 726.4 222.4 726.4 393.6 587.2 704 416 704z" />
            </svg>
          </span>
        }
        placeholder={t('searchApps', 'Search apps')}
        className="mb-6 import-search-input import-search-input-spaced"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ maxWidth: 320 }}
      />

      <Typography.Title level={4} className="mt-6 mb-6">
        {t('importFrom', 'Where would you like to import from?')}
      </Typography.Title>
      <div className="import-source-grid-scroll">
        <div className="import-source-grid">
          {filteredSources.map(source => (
            <div
              className="import-source-card"
              key={source.key}
              onClick={() => handleSourceClick(source)}
              style={{ cursor: 'pointer' }}
            >
              <div className="import-source-icon">{source.icon}</div>
              <span className="import-source-label">{source.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Can't find your app? section */}
      <div className="cant-find-app-section mt-10">
        <Card className="cant-find-app-card" bordered={false}>
          <Typography.Title level={5} className="mb-1">
            {t('cantFindAppTitle', "Can't find your app?")}
          </Typography.Title>
          <Typography.Text type="secondary" className="mb-4 d-block">
            {t(
              'cantFindAppDesc',
              "If you don't see your app here, select CSV to use any CSV file to import your data."
            )}
          </Typography.Text>
          <div className="csv-card-row">
            <Card hoverable className="import-source-card csv-only-card">
              <div className="import-source-icon">
                <TableOutlined style={{ color: '#4CAF50' }} />
              </div>
              <Typography.Text>CSV</Typography.Text>
            </Card>
          </div>
        </Card>
      </div>
      <ImportSourceModal open={modalOpen} onClose={handleModalClose} source={selectedSource} />
    </div>
  );
};

export default ImportExportSettings;
