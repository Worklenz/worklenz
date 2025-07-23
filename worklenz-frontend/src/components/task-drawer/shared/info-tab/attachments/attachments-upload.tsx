import { LoadingOutlined, PlusOutlined } from '@/shared/antd-imports';
import React, { useRef, useState } from 'react';
import { TFunction } from 'i18next';
import './attachments-upload.css';
import { useAppSelector } from '@/hooks/useAppSelector';

interface AttachmentsUploadProps {
  t: TFunction;
  loadingTask: boolean;
  uploading: boolean;
  onFilesSelected: (files: File[]) => void;
}

const AttachmentsUpload = ({
  t,
  loadingTask,
  uploading,
  onFilesSelected,
}: AttachmentsUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const filesArray = Array.from(event.target.files);
      onFilesSelected(filesArray);
    }
  };

  const handleClick = () => {
    if (!loadingTask && !uploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    if (!loadingTask && !uploading && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      onFilesSelected(filesArray);
    }
  };

  return (
    <div
      className={`ant-upload-list ant-upload-list-picture-card ${isDragOver ? 'focused' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttachmentsUpload;
