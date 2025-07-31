import { Button, Card, Form, Input, Select, Typography, Upload, message, Flex } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../hooks/useAppSelector';
import { UploadOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Option } = Select;

const NewRequestForm = () => {
  const { t } = useTranslation('client-view-requests');
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Get available services from Redux (replace with API call)
  const availableServices = useAppSelector((state) => 
    state.clientViewReducer.serviceReducer.services || []
  );

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      console.log('Submitting request:', values);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      message.success(t('requestSubmittedSuccess'));
      navigate('/client-portal/requests');
    } catch (error) {
      message.error(t('requestSubmissionError'));
    } finally {
      setLoading(false);
    }
  };

  const onCancel = () => {
    navigate('/client-portal/requests');
  };

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Typography.Title level={4} style={{ marginBlock: 0 }}>
        {t('newRequest')}
      </Typography.Title>

      <Card style={{ maxWidth: 800 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            priority: 'medium',
            attachments: []
          }}
        >
          <Form.Item
            name="service_id"
            label={t('service')}
            rules={[{ required: true, message: t('serviceRequired') }]}
          >
            <Select placeholder={t('selectService')}>
              {availableServices.map((service: any) => (
                <Option key={service.id} value={service.id}>
                  {service.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="title"
            label={t('requestTitle')}
            rules={[{ required: true, message: t('titleRequired') }]}
          >
            <Input placeholder={t('enterRequestTitle')} />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('description')}
            rules={[{ required: true, message: t('descriptionRequired') }]}
          >
            <TextArea 
              rows={4} 
              placeholder={t('enterRequestDescription')}
            />
          </Form.Item>

          <Form.Item
            name="priority"
            label={t('priority')}
          >
            <Select>
              <Option value="low">{t('low')}</Option>
              <Option value="medium">{t('medium')}</Option>
              <Option value="high">{t('high')}</Option>
              <Option value="urgent">{t('urgent')}</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="attachments"
            label={t('attachments')}
          >
            <Upload
              listType="text"
              beforeUpload={() => false}
              maxCount={5}
            >
              <Button icon={<UploadOutlined />}>
                {t('uploadFiles')}
              </Button>
            </Upload>
          </Form.Item>

          <Form.Item
            name="notes"
            label={t('additionalNotes')}
          >
            <TextArea 
              rows={3} 
              placeholder={t('enterAdditionalNotes')}
            />
          </Form.Item>

          <Form.Item>
            <Flex gap={12}>
              <Button type="primary" htmlType="submit" loading={loading}>
                {t('submitRequest')}
              </Button>
              <Button onClick={onCancel}>
                {t('cancel')}
              </Button>
            </Flex>
          </Form.Item>
        </Form>
      </Card>
    </Flex>
  );
};

export default NewRequestForm; 