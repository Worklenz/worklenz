import {
  Button,
  Divider,
  Flex,
  Form,
  Input,
  message,
  Modal,
  Select,
  Typography,
  Upload,
} from '@/shared/antd-imports';
import React from 'react';
import { useAppDispatch } from '../../../../hooks/useAppDispatch';
import { toggleRequestFormModal } from '../client-view-services';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { UploadProps } from 'antd/lib';
import { InboxOutlined } from '@ant-design/icons';
import { nanoid } from '@reduxjs/toolkit';

const RequestFormModal = ({ serviceId }: { serviceId: string }) => {
  // localization
  const { t } = useTranslation('client-view-services');

  // get service details from client view service reducer
  const { isRequestFormModalOpen, services } = useAppSelector(
    state => state.clientViewReducer.serviceReducer
  );

  const dispatch = useAppDispatch();

  const [form] = Form.useForm();

  // function to handle form submit
  const handleFormSubmit = (values: any) => {
    const newRequest = {
      id: nanoid(),
      name: values.question,
    };

    console.log(values);

    dispatch(toggleRequestFormModal());
    form.resetFields();
    console.log(newRequest);
  };

  // find the selected service from the services array
  const service = services.find(service => service.id === serviceId);

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
    <Modal
      open={isRequestFormModalOpen}
      title={
        <Flex style={{ width: '100%' }}>
          <Typography.Title level={5}>{t('modal.title')}</Typography.Title>
        </Flex>
      }
      width={600}
      onCancel={() => dispatch(toggleRequestFormModal())}
      footer={null}
    >
      <Divider style={{ marginBlockStart: 0 }} />
      <Form form={form} onFinish={handleFormSubmit}>
        {service?.service_data?.request_form?.map((item, index) => (
          <Form.Item
            key={index}
            name={item.question}
            label={item.question}
            // rules={[{ required: true }]}
          >
            {item.type === 'text' ? (
              <Input style={{ width: '100%' }} />
            ) : item.type === 'multipleChoice' ? (
              <Select
                style={{ width: '100%' }}
                options={
                  Array.isArray(item?.answer)
                    ? item.answer.map((answer, index) => ({
                        value: index,
                        label: answer,
                      }))
                    : []
                }
              />
            ) : (
              <Upload.Dragger {...props} style={{ width: '100%' }}>
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">{t('uploadLogoText')}</p>
                <p className="ant-upload-hint">{t('uploadLogoAltText')}</p>
              </Upload.Dragger>
            )}
          </Form.Item>
        ))}

        <Divider />
        <Flex justify="flex-end">
          <Button type="primary" htmlType="submit">
            {t('modal.submitButton')}
          </Button>
        </Flex>
      </Form>
    </Modal>
  );
};

export default RequestFormModal;
