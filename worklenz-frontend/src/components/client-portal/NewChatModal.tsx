import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Typography,
  Space,
  message,
} from '@/shared/antd-imports';
import { MessageOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  useCreateChatMutation,
} from '@/api/client-portal/client-portal-api';

const { TextArea } = Input;

interface NewChatModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (chatId: string) => void;
}

interface NewChatForm {
  subject: string;
  message: string;
}

const NewChatModal: React.FC<NewChatModalProps> = ({ open, onClose, onSuccess }) => {
  const { t } = useTranslation(['client-portal-chats', 'common']);
  const [form] = Form.useForm<NewChatForm>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [createChat] = useCreateChatMutation();

  const handleSubmit = async (values: NewChatForm) => {
    try {
      setIsSubmitting(true);

      // For client portal, always message the team (no recipient selection needed)
      const response = await createChat({
        recipientType: 'team',
        recipientId: 'organization', // Backend will use organization context
        subject: values.subject,
        message: values.message,
      }).unwrap();

      message.success(t('newChatCreatedSuccessfully', { ns: 'client-portal-chats' }) || 'Chat created successfully!');
      form.resetFields();
      onClose();
      onSuccess?.(response.chatId);
    } catch (error) {
      console.error('Failed to create new chat:', error);
      message.error(t('newChatFailed', { ns: 'client-portal-chats' }) || 'Failed to create chat. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={
        <Space>
          <MessageOutlined />
          <Typography.Text strong>
            {t('newChat', { ns: 'client-portal-chats' }) || 'New Chat'}
          </Typography.Text>
        </Space>
      }
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={600}
      destroyOnClose
      maskClosable={false}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ marginTop: 24 }}
      >
        <Form.Item
          name="subject"
          label={t('subject', { ns: 'client-portal-chats' }) || 'Subject'}
          rules={[
            { required: true, message: t('subjectRequired', { ns: 'common' }) || 'Please enter a subject' },
            { min: 3, message: t('subjectTooShort', { ns: 'common' }) || 'Subject must be at least 3 characters' },
            { max: 100, message: t('subjectTooLong', { ns: 'common' }) || 'Subject must be less than 100 characters' },
          ]}
        >
          <Input
            placeholder={t('subjectPlaceholder', { ns: 'client-portal-chats' }) || 'Enter chat subject'}
            maxLength={100}
            showCount
          />
        </Form.Item>

        <Form.Item
          name="message"
          label={t('message', { ns: 'client-portal-chats' }) || 'Initial Message'}
          rules={[
            { required: true, message: t('messageRequired', { ns: 'common' }) || 'Please enter a message' },
            { min: 10, message: t('messageTooShort', { ns: 'common' }) || 'Message must be at least 10 characters' },
            { max: 1000, message: t('messageTooLong', { ns: 'common' }) || 'Message must be less than 1000 characters' },
          ]}
        >
          <TextArea
            placeholder={t('messagePlaceholder', { ns: 'client-portal-chats' }) || 'Type your message here...'}
            rows={4}
            maxLength={1000}
            showCount
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 32 }}>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={handleCancel} disabled={isSubmitting}>
              {t('cancel', { ns: 'common' }) || 'Cancel'}
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={isSubmitting}
              icon={<MessageOutlined />}
            >
              {t('sendMessage', { ns: 'client-portal-chats' }) || 'Send Message'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default NewChatModal;