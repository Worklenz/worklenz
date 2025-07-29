import React, { useState, useEffect } from 'react';
import { Modal, Upload, Button, Typography, Divider, Alert, Space, notification } from 'antd';
import { UploadOutlined, DownloadOutlined, InboxOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import apiClient, { getCsrfToken, refreshCsrfToken } from '../../api/api-client';
import './csv-import-modal.css';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

interface CSVImportModalProps {
  visible: boolean;
  projectId: string;
  onClose: () => void;
  onImportComplete: () => void;
}

const CSVImportModal: React.FC<CSVImportModalProps> = ({
  visible,
  projectId,
  onClose,
  onImportComplete,
}) => {
  const { t } = useTranslation('csv-import');
  const [fileList, setFileList] = useState<UploadFile[]>([]); //Stores the uploaded file.
  const [uploading, setUploading] = useState(false); //Boolean to show a loading spinner.

  // Pre-fetch CSRF token when modal opens to prevent first-time errors
  useEffect(() => {
    if (visible) {
      const ensureCSRFToken = async () => {
        const token = getCsrfToken();
        if (!token) {
          console.log('Pre-fetching CSRF token...');
          await refreshCsrfToken();
        }
      };
      ensureCSRFToken();
    }
  }, [visible]);

  //Download Sample CSV Template
  const downloadTemplate = () => {
    const csvContent = 'Task Title,Description\nSample Task 1,This is a sample task description\nSample Task 2,Another sample description\nTask with empty description,\nImportant Task,This task needs immediate attention';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'import-template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  //Validate File Before Upload
  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    const isCSV = file.type === 'text/csv' || file.name?.toLowerCase().endsWith('.csv'); //File must be .csv
    if (!isCSV) {
      return false;
    }

    const isLt5M = file.size / 1024 / 1024 < 5;   //File must be under 5MB
    if (!isLt5M) {
      return false;
    }

    setFileList([file]);
    return false; // Don't auto upload
  };

  //This function is triggered when the user clicks "Import Tasks".
  const handleImport = async () => {
    if (fileList.length === 0) {
      return;
    }

    setUploading(true);

    try {
      // Ensure we have a CSRF token before making the request
      let csrfToken = getCsrfToken();
      if (!csrfToken) {
        console.log('No CSRF token found, refreshing...');
        await refreshCsrfToken();
        csrfToken = getCsrfToken();
        if (!csrfToken) {
          throw new Error('Failed to obtain CSRF token');
        }
      }

      // Create FormData and append the CSV file
      const formData = new FormData();             //Prepares the uploaded file using FormData.
      formData.append('csvFile', (fileList[0] as any).originFileObj || fileList[0]);

      const response = await apiClient.post(`/api/v1/tasks/import-csv/${projectId}`, formData, {  //Sends it to the backend endpoint (/import-csv/:projectId).
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const result = response.data;

      //On Successful Import
      if (result.done && result.body) {
        notification.success({
          message: t("success.importComplete", "Import completed"),     //Shows success notification.
          description: `Successfully imported ${result.body.processed} tasks out of ${result.body.total} total.`,
        });
        
        // Auto-close modal after successful import
        setTimeout(() => {
          handleClose();
          onImportComplete();
        }, 2000);  //Auto-closes modal after 2 seconds and notifies parent component.
      } else {
        throw new Error(result.message || "Import failed");
      }
    } catch (error: any) {
      console.error("Import error:", error);
      
      // Handle different types of errors with more specific messages
      let errorMessage = "Failed to import CSV file. Please try again.";
      
      if (error.response?.status === 401) {
        errorMessage = "Authentication required. Please log in again.";
      } else if (error.response?.status === 403) {
        errorMessage = "Access denied. You don't have permission to import CSV files.";
      } else if (error.response?.status === 404) {
        errorMessage = "CSV import feature is not available or the project was not found.";
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message === 'Failed to obtain CSRF token') {
        errorMessage = "Security token error. Please refresh the page and try again.";
        // Also show a more user-friendly notification
        notification.warning({
          message: "Security Token Required",
          description: "Please refresh the page to initialize security tokens, then try uploading again.",
          duration: 5,
        });
        return; // Don't show the generic error notification
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      notification.error({
        message: t("errors.importFailed", "Import failed"),
        description: errorMessage,
      });
    } finally {
      setUploading(false);   //Stops the loading spinner, no matter success or error.
    }
  };

  const handleClose = () => {   //handleClose() resets everything and calls the parent onClose().
    setFileList([]);
    setUploading(false);
    onClose();
  };

  const removeFile = () => {   //removeFile() clears the uploaded file.
    setFileList([]);
  };

  return (
    <Modal
      title={
        <Space>
          <InboxOutlined />
          {t('title', 'Import Tasks from CSV')}
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      width={600}
      className="csv-import-modal"
      footer={[
        <Button key="cancel" onClick={handleClose} disabled={uploading}>
          {t('cancel', 'Cancel')}
        </Button>,
        <Button
          key="import"
          type="primary"
          loading={uploading}
          disabled={fileList.length === 0}
          onClick={handleImport}
        >
          {t('importTasks', 'Import Tasks')}
        </Button>,
      ]}
    >
      <div style={{ padding: '8px 0' }}>
        {/* Instructions */}
        <Alert
          message={t('instructions.title', 'Instructions')}
          description={
            <div>
              <Paragraph style={{ marginBottom: 8 }}>
                {t('instructions.upload', 'Upload a CSV file to import tasks.')}
              </Paragraph>
              <Paragraph style={{ marginBottom: 8 }}>
                {t('instructions.format', 'The file must contain exactly two columns in this order: Task Title and Description.')}
              </Paragraph>
              <Paragraph style={{ marginBottom: 0 }}>
                {t('instructions.header', 'The first row should be the header row and will be skipped.')}
              </Paragraph>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        {/* Template Download */}
        <div style={{ marginBottom: 16 }}>
          <Button
            icon={<DownloadOutlined />}
            onClick={downloadTemplate}
            type="link"
            style={{ padding: 0 }}
          >
            {t('downloadTemplate', 'Download sample CSV template')}
          </Button>
        </div>

        <Divider />

        {/* Import Results - Removed duplicate error display since notifications handle this */}

        {/* File Upload */}
        <Dragger
          name="csvFile"
          multiple={false}
          fileList={fileList}
          beforeUpload={beforeUpload}
          onRemove={removeFile}
          accept=".csv,text/csv"
          style={{ marginBottom: 16 }}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          </p>
          <p className="ant-upload-text">
            {t('upload.title', 'Click or drag CSV file to this area to upload')}
          </p>
          <p className="ant-upload-hint">
            {t('upload.hint', 'Only CSV files are supported. Maximum file size is 5MB.')}
          </p>
        </Dragger>

        {/* File validation messages */}
        {fileList.length > 0 && (
          <Alert
            message={t('validation.ready', 'File ready for import')}
            description={`${t('validation.selected', 'Selected file')}: ${fileList[0].name}`}
            type="success"
            showIcon
            style={{ marginTop: 8 }}
          />
        )}
      </div>
    </Modal>
  );
};

export default CSVImportModal;
