import { LoadingOutlined, PlusOutlined } from '@/shared/antd-imports';
import React, { useRef } from 'react';
import { TFunction } from 'i18next';
import './attachments-upload.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_file_uploaded } from '@/shared/worklenz-analytics-events';
import { getFileType } from '@/types/mixpanel-events.types';

interface AttachmentsUploadProps {
  t: TFunction;
  loadingTask: boolean;
  uploading: boolean;
  onFilesSelected: (files: File[]) => void;
  onUpgradeRequested?: () => void;
  maxFileSizeMb?: number;
  showUpgradeLink?: boolean;
}

const AttachmentsUpload = ({
  t,
  loadingTask,
  uploading,
  onFilesSelected,
  onUpgradeRequested,
  maxFileSizeMb = 25,
  showUpgradeLink = true,
}: AttachmentsUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { trackMixpanelEvent } = useMixpanelTracking();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const filesArray = Array.from(event.target.files);
      filesArray.forEach(file => {
        trackMixpanelEvent(evt_file_uploaded, { file_type: getFileType(file.name) });
      });
      onFilesSelected(filesArray);
    }
  };

  const handleClick = () => {
    if (!loadingTask && !uploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="task-drawer-attachments-upload ant-upload-list ant-upload-list-picture-card">
      <div className="ant-upload ant-upload-select ant-upload-select-picture-card">
        <div
          className="ant-upload"
          tabIndex={0}
          role="button"
          onClick={handleClick}
          style={{
            backgroundColor: themeMode === 'dark' ? '#292929' : '#fafafa',
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
            disabled={loadingTask || uploading}
            multiple
          />
          <div>
            {uploading ? <LoadingOutlined spin /> : <PlusOutlined />}
            <div
              style={{
                marginTop: '8px',
                fontSize: '11px',
                marginLeft: 'auto',
                marginRight: 'auto',
                paddingLeft: '8px',
                paddingRight: '8px',
              }}
            >
              {uploading
                ? t('taskInfoTab.attachments.uploading')
                : t('taskInfoTab.attachments.chooseOrDropFileToUpload')}
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: '#8c8c8c' }}>
              {t('taskInfoTab.attachments.maxFileSizeText', {
                maxSize: maxFileSizeMb,
                defaultValue: 'Max file size: {{maxSize}}MB',
              })}{' '}
              {showUpgradeLink && (
                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation();
                    onUpgradeRequested?.();
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#1677ff',
                    padding: 0,
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  {t('taskInfoTab.attachments.upgradeLinkText', {
                    defaultValue: 'Need larger uploads? Upgrade',
                  })}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttachmentsUpload;
