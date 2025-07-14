import { Card, Flex, message, Typography, Upload, UploadProps } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import companyLogo from '../../../assets/images/client-view-logo.png';
import { InboxOutlined } from '@ant-design/icons';

const ClientPortalSettings = () => {
  // localization
  const { t } = useTranslation('client-portal-settings');

  const props: UploadProps = {
    name: 'file',
    multiple: true,
    action: 'https://660d2bd96ddfa2943b33731c.mockapi.io/api/upload',
    onChange(info) {
      const { status } = info.file;
      if (status !== 'uploading') {
        console.log(info.file, info.fileList);
      }
      if (status === 'done') {
        message.success(`${info.file.name} file uploaded successfully.`);
      } else if (status === 'error') {
        message.error(`${info.file.name} file upload failed.`);
      }
    },
    onDrop(e) {
      console.log('Dropped files', e.dataTransfer.files);
    },
  };

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" style={{ width: '100%' }}>
        <Typography.Title level={5}>{t('title')}</Typography.Title>
      </Flex>

      <Card style={{ height: 'calc(100vh - 280px)' }}>
        <Flex vertical gap={48}>
          <Flex vertical gap={12}>
            <Typography.Text>{t('currentLogoText')}</Typography.Text>
            <img
              src={companyLogo}
              alt="company logo"
              style={{ maxWidth: 180, maxHeight: 100 }}
            />
          </Flex>
          <Upload.Dragger {...props} style={{ maxWidth: 450 }}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">{t('uploadLogoText')}</p>
            <p className="ant-upload-hint">{t('uploadLogoAltText')}</p>
          </Upload.Dragger>
        </Flex>
      </Card>
    </Flex>
  );
};

export default ClientPortalSettings;
