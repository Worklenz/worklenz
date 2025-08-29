import React, { useState } from 'react';
import {
  Upload,
  Button,
  message,
  List,
  Card,
  Space,
  Typography,
  Popconfirm,
  Tag,
  Tooltip,
  Image,
  UploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileOutlined,
  FileImageOutlined,
  VideoCameraOutlined,
  FileTextOutlined,
  FilePdfOutlined
} from '@/shared/antd-imports';
import { UploadFile, UploadProps } from 'antd/es/upload/interface';
import clientPortalAPI from '@/services/api';
import { ApiResponse } from '@/types';

const { Text } = Typography;

interface FileUploaderProps {
  purpose?: string;
  maxFiles?: number;
  acceptedFileTypes?: string;
  maxFileSize?: number; // in MB
  onFilesChange?: (files: UploadedFileInfo[]) => void;
  initialFiles?: UploadedFileInfo[];
  showFileList?: boolean;
  listType?: 'text' | 'picture' | 'picture-card';
  disabled?: boolean;
}

interface UploadedFileInfo {
  id?: string;
  url: string;
  filename: string;
  originalName: string;
  fileType: string;
  size: number;
  uploadedAt: string;
  purpose: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  purpose = 'general',
  maxFiles = 10,
  acceptedFileTypes = '*',
  maxFileSize = 10,
  onFilesChange,
  initialFiles = [],
  showFileList = true,
  listType = 'text',
  disabled = false
}) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>(initialFiles);
  const [uploading, setUploading] = useState(false);

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <FileImageOutlined />;
    if (fileType.startsWith('video/')) return <VideoCameraOutlined />;
    if (fileType.includes('pdf')) return <FilePdfOutlined />;
    if (fileType.includes('text') || fileType.includes('doc')) return <FileTextOutlined />;
    return <FileOutlined />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): boolean => {
    // Check file size
    if (file.size > maxFileSize * 1024 * 1024) {
      message.error(`File size must be smaller than ${maxFileSize}MB`);
      return false;
    }

    // Check file type if specified
    if (acceptedFileTypes !== '*') {
      const acceptedTypes = acceptedFileTypes.split(',').map(type => type.trim());
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      const mimeType = file.type;
      
      const isValidType = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return fileExtension === type.toLowerCase();
        }
        if (type.includes('/*')) {
          const category = type.split('/')[0];
          return mimeType.startsWith(category);
        }
        return mimeType === type;
      });

      if (!isValidType) {
        message.error(`File type not allowed. Accepted types: ${acceptedFileTypes}`);
        return false;
      }
    }

    return true;
  };

  const customUpload: UploadProps['customRequest'] = async ({ file, onSuccess, onError, onProgress }) => {
    if (!validateFile(file as File)) {
      onError?.(new Error('File validation failed'));
      return;
    }

    try {
      setUploading(true);
      
      // Simulate progress
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 10;
        if (progress <= 90) {
          onProgress?.({ percent: progress });
        }
      }, 100);

      const response: ApiResponse<UploadedFileInfo> = await clientPortalAPI.uploadFile(file as File, purpose);
      
      clearInterval(progressInterval);
      onProgress?.({ percent: 100 });

      if (response.done && response.body) {
        const uploadedFile = response.body;
        setUploadedFiles(prev => {
          const updated = [...prev, uploadedFile];
          onFilesChange?.(updated);
          return updated;
        });
        
        onSuccess?.(response.body);
        message.success('File uploaded successfully');
      } else {
        throw new Error(response.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      onError?.(error as Error);
      message.error('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = (file: UploadFile | UploadedFileInfo) => {
    if ('id' in file) {
      // Remove from uploaded files
      setUploadedFiles(prev => {
        const updated = prev.filter(f => f.id !== file.id);
        onFilesChange?.(updated);
        return updated;
      });
    } else {
      // Remove from file list (pending uploads)
      const uploadFile = file as UploadFile;
      setFileList(prev => prev.filter(f => f.uid !== uploadFile.uid));
    }
  };

  const handlePreview = (file: UploadedFileInfo) => {
    if (file.fileType.startsWith('image/')) {
      // For images, show in modal
      // @ts-ignore
      Image.PreviewGroup?.preview?.({ src: file.url }) || window.open(file.url, '_blank');
    } else {
      // For other files, open in new tab
      window.open(file.url, '_blank');
    }
  };

  const handleDownload = (file: UploadedFileInfo) => {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.originalName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const uploadProps: UploadProps = {
    multiple: maxFiles > 1,
    fileList: fileList,
    customRequest: customUpload,
    onChange: ({ fileList: newFileList }) => {
      setFileList(newFileList);
    },
    onRemove: handleRemove,
    beforeUpload: (file, files) => {
      if (uploadedFiles.length + files.length > maxFiles) {
        message.error(`You can only upload up to ${maxFiles} files`);
        return false;
      }
      return validateFile(file);
    },
    showUploadList: !showFileList ? false : {
      showPreviewIcon: true,
      showRemoveIcon: true,
      showDownloadIcon: false,
    },
    accept: acceptedFileTypes === '*' ? undefined : acceptedFileTypes,
    disabled: disabled || uploading,
    listType
  };

  return (
    <div>
      <Upload {...uploadProps}>
        <Button 
          icon={<UploadOutlined />} 
          loading={uploading}
          disabled={disabled || uploadedFiles.length >= maxFiles}
        >
          {uploading ? 'Uploading...' : 'Upload Files'}
        </Button>
      </Upload>

      {showFileList && uploadedFiles.length > 0 && (
        <Card 
          title={`Uploaded Files (${uploadedFiles.length})`} 
          size="small" 
          style={{ marginTop: 16 }}
        >
          <List
            dataSource={uploadedFiles}
            renderItem={(file) => (
              <List.Item
                actions={[
                  <Tooltip title="Preview">
                    <Button
                      type="text"
                      icon={<EyeOutlined />}
                      onClick={() => handlePreview(file)}
                      size="small"
                    />
                  </Tooltip>,
                  <Tooltip title="Download">
                    <Button
                      type="text"
                      icon={<DownloadOutlined />}
                      onClick={() => handleDownload(file)}
                      size="small"
                    />
                  </Tooltip>,
                  <Popconfirm
                    title="Are you sure you want to delete this file?"
                    onConfirm={() => handleRemove(file)}
                  >
                    <Tooltip title="Delete">
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        size="small"
                      />
                    </Tooltip>
                  </Popconfirm>
                ]}
              >
                <List.Item.Meta
                  avatar={getFileIcon(file.fileType)}
                  title={
                    <Space>
                      <Text ellipsis style={{ maxWidth: 200 }}>
                        {file.originalName}
                      </Text>
                      <Tag color="blue">
                        {formatFileSize(file.size)}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Uploaded on {new Date(file.uploadedAt).toLocaleDateString()}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      <div style={{ marginTop: 8, fontSize: '12px', color: '#888' }}>
        <Text type="secondary">
          Maximum file size: {maxFileSize}MB | 
          Maximum files: {maxFiles} | 
          Accepted types: {acceptedFileTypes === '*' ? 'Any' : acceptedFileTypes}
        </Text>
      </div>
    </div>
  );
};

export default FileUploader;