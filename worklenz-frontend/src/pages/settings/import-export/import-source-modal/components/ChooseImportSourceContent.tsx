import React from 'react';
import { Card, Modal, Typography } from '@/shared/antd-imports';
import { AVAILABLE_IMPORT_SOURCES } from '../source-icons';

interface ImportSourceOption {
  key: string;
  icon: React.ReactNode;
  label: string;
  order: number;
  comingSoon: boolean;
}

interface ChooseImportSourceContentProps {
  open: boolean;
  onClose: () => void;
  t: (key: string, defaultValueOrOptions?: any, options?: any) => string;
  modalTitle: React.ReactNode;
  onSourcePick: (selected: ImportSourceOption) => void;
}

export const ChooseImportSourceContent: React.FC<ChooseImportSourceContentProps> = ({
  open,
  onClose,
  t,
  modalTitle,
  onSourcePick,
}) => (
  <Modal
    open={open}
    onCancel={onClose}
    footer={null}
    width={900}
    destroyOnHidden
    title={modalTitle}
    styles={{
      header: {
        paddingBottom: 8,
      },
      body: {
        padding: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      },
    }}
  >
    <div className="import-export-settings import-export-modal-content-wrapper">
      <Typography.Title level={4} className="section-title">
        {t('importFrom', { defaultValue: 'Choose your source' })}
      </Typography.Title>

      <div className="import-source-grid">
        {AVAILABLE_IMPORT_SOURCES.filter(sourceOption => sourceOption.key !== 'csv')
          .sort((a, b) => a.order - b.order)
          .map(sourceOption => (
            <div
              className={`import-source-card${sourceOption.comingSoon ? ' import-source-card--coming-soon' : ''}`}
              key={sourceOption.key}
              role={sourceOption.comingSoon ? undefined : 'button'}
              tabIndex={sourceOption.comingSoon ? -1 : 0}
              onClick={sourceOption.comingSoon ? undefined : () => onSourcePick(sourceOption)}
              onKeyDown={
                sourceOption.comingSoon
                  ? undefined
                  : e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSourcePick(sourceOption);
                      }
                    }
              }
            >
              <div className="import-source-content">
                <div className="import-source-icon">{sourceOption.icon}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="import-source-label">{sourceOption.label}</span>
                  {sourceOption.comingSoon && (
                    <span className="import-source-coming-soon-badge">Coming soon</span>
                  )}
                </div>
              </div>
            </div>
          ))}
      </div>

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
            onClick={() => {
              const csvSource = AVAILABLE_IMPORT_SOURCES.find(item => item.key === 'csv');
              if (csvSource) onSourcePick(csvSource);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const csvSource = AVAILABLE_IMPORT_SOURCES.find(item => item.key === 'csv');
                if (csvSource) onSourcePick(csvSource);
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
    </div>
  </Modal>
);
