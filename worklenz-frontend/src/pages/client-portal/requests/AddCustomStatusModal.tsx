import {
  Modal,
  Input,
  Button,
  Flex,
  Typography,
  Tag,
  Popconfirm,
  message,
  theme,
  DeleteOutlined,
} from '@/shared/antd-imports';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useGetRequestCustomStatusesQuery,
  useCreateRequestCustomStatusMutation,
  useDeleteRequestCustomStatusMutation,
} from '../../../api/client-portal/client-portal-api';

const COLOR_OPTIONS = [
  'default',
  'blue',
  'green',
  'orange',
  'red',
  'purple',
  'cyan',
  'magenta',
];

interface AddCustomStatusModalProps {
  open: boolean;
  onClose: () => void;
}

const AddCustomStatusModal: React.FC<AddCustomStatusModalProps> = ({ open, onClose }) => {
  const { t } = useTranslation('client-portal-requests');
  const { token } = theme.useToken();

  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_OPTIONS[0]);

  const { data, isLoading } = useGetRequestCustomStatusesQuery(undefined, { skip: !open });
  const [createStatus, { isLoading: isCreating }] = useCreateRequestCustomStatusMutation();
  const [deleteStatus] = useDeleteRequestCustomStatusMutation();

  const customStatuses = data?.body ?? [];

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      message.error(t('customStatusNameRequired', { defaultValue: 'Enter a status name' }));
      return;
    }

    try {
      await createStatus({ name: trimmed, color }).unwrap();
      message.success(
        t('customStatusAddedSuccess', { defaultValue: 'Custom status added' })
      );
      setName('');
      setColor(COLOR_OPTIONS[0]);
    } catch (err) {
      const errorData = (err as { data?: { message?: string } })?.data;
      message.error(
        errorData?.message ||
          t('customStatusAddedError', { defaultValue: 'Failed to add custom status' })
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteStatus(id).unwrap();
      message.success(
        t('customStatusRemovedSuccess', { defaultValue: 'Custom status removed' })
      );
    } catch {
      message.error(
        t('customStatusRemovedError', { defaultValue: 'Failed to remove custom status' })
      );
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('addCustomStatusTitle', { defaultValue: 'Add Custom Status' })}
      footer={
        <Button onClick={onClose}>{t('closeButton', { defaultValue: 'Close' })}</Button>
      }
      width={420}
    >
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('addCustomStatusDescription', {
          defaultValue:
            'Custom statuses are shared with your whole team and appear alongside the built-in statuses.',
        })}
      </Typography.Text>

      <Flex vertical gap={8} style={{ marginTop: 16 }}>
        <Input
          value={name}
          maxLength={40}
          placeholder={t('customStatusNamePlaceholder', { defaultValue: 'e.g. Awaiting Client' })}
          onChange={event => setName(event.target.value)}
          onPressEnter={handleAdd}
        />

        <Flex align="center" gap={8} wrap="wrap">
          {COLOR_OPTIONS.map(option => (
            <button
              key={option}
              type="button"
              aria-label={option}
              aria-pressed={color === option}
              onClick={() => setColor(option)}
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                cursor: 'pointer',
                padding: 0,
                border:
                  color === option
                    ? `2px solid ${token.colorPrimary}`
                    : `1px solid ${token.colorBorder}`,
                background: 'transparent',
              }}
            >
              <Tag color={option === 'default' ? undefined : option} style={{ margin: 0, width: '100%', height: '100%', borderRadius: '50%', display: 'inline-block' }} />
            </button>
          ))}
        </Flex>

        <Button type="primary" onClick={handleAdd} loading={isCreating}>
          {t('addCustomStatusButton', { defaultValue: 'Add Status' })}
        </Button>
      </Flex>

      <Flex vertical gap={8} style={{ marginTop: 20 }}>
        <Typography.Text strong style={{ fontSize: 12 }}>
          {t('existingCustomStatusesLabel', { defaultValue: 'Existing custom statuses' })}
        </Typography.Text>

        {isLoading ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('loadingText', { defaultValue: 'Loading...' })}
          </Typography.Text>
        ) : customStatuses.length === 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('noCustomStatusesYet', { defaultValue: 'No custom statuses yet.' })}
          </Typography.Text>
        ) : (
          <Flex vertical gap={6}>
            {customStatuses.map(status => (
              <Flex key={status.id} align="center" justify="space-between">
                <Tag color={status.color === 'default' ? undefined : status.color}>
                  {status.name}
                </Tag>
                <Popconfirm
                  title={t('removeCustomStatusConfirm', {
                    defaultValue: 'Remove this custom status?',
                  })}
                  okText={t('deleteConfirmationOk', { defaultValue: 'Delete' })}
                  cancelText={t('deleteConfirmationCancel', { defaultValue: 'Cancel' })}
                  onConfirm={() => handleDelete(status.id)}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    aria-label={t('removeCustomStatusLabel', {
                      name: status.name,
                      defaultValue: 'Remove {{name}}',
                    })}
                  />
                </Popconfirm>
              </Flex>
            ))}
          </Flex>
        )}
      </Flex>
    </Modal>
  );
};

export default AddCustomStatusModal;
