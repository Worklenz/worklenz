import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Flex,
  Modal,
  Typography,
  theme,
  WarningOutlined,
  ExclamationCircleFilled,
} from '@/shared/antd-imports';

interface DangerZoneSectionProps {
  onConfirmDelete: () => void | Promise<void>;
  isDeleting: boolean;
  canDelete: boolean;
}

const DangerZoneSection = ({ onConfirmDelete, isDeleting, canDelete }: DangerZoneSectionProps) => {
  const { t } = useTranslation('project-drawer');
  const { token } = theme.useToken();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const showDeleteModal = () => setIsDeleteModalOpen(true);
  const hideDeleteModal = () => setIsDeleteModalOpen(false);

  const handleDelete = async () => {
    setIsDeleteModalOpen(false);
    await onConfirmDelete();
  };

  return (
    <Flex vertical gap={16}>
      <div>
        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
          {t('dangerZoneSectionTitle', { defaultValue: 'Danger Zone' })}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
          {t('dangerZoneSectionDescription', {
            defaultValue: 'Irreversible actions for this project.',
          })}
        </Typography.Paragraph>
      </div>

      <div
        style={{
          border: `1px solid ${token.colorErrorBorder}`,
          borderRadius: 10,
          background: token.colorErrorBg,
          padding: 16,
        }}
      >
        <Flex align="center" justify="space-between" gap={16} wrap="wrap">
          <Flex align="flex-start" gap={12}>
            <Flex
              align="center"
              justify="center"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: token.colorBgContainer,
                border: `1px solid ${token.colorErrorBorder}`,
                color: token.colorError,
                flexShrink: 0,
              }}
            >
              <WarningOutlined />
            </Flex>
            <div>
              <Typography.Text style={{ fontSize: 13, fontWeight: 600, display: 'block' }}>
                {t('deleteProjectTitle', { defaultValue: 'Delete this project' })}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {canDelete
                  ? t('deleteProjectDescription', {
                      defaultValue:
                        'Once deleted, all tasks, phases, and project data will be permanently removed.',
                    })
                  : t('noPermission')}
              </Typography.Text>
            </div>
          </Flex>

          {canDelete && (
            <Button danger loading={isDeleting} onClick={showDeleteModal} style={{ flexShrink: 0 }}>
              {t('delete')}
            </Button>
          )}
        </Flex>
      </div>

      <Modal
        title={
          <Flex align="center" gap={8}>
            <ExclamationCircleFilled style={{ color: token.colorError }} />
            <span>{t('confirmDeletionTitle')}</span>
          </Flex>
        }
        open={isDeleteModalOpen}
        onOk={handleDelete}
        onCancel={hideDeleteModal}
        okText={t('confirmDelete')}
        cancelText={t('cancel')}
        okButtonProps={{ danger: true, loading: isDeleting }}
        width={480}
        centered
        styles={{
          content: { borderRadius: 12 },
          header: { paddingBottom: 12, borderBottom: `1px solid ${token.colorBorderSecondary}` },
        }}
      >
        <Flex vertical gap={12} style={{ paddingTop: 12 }}>
          <Typography.Text style={{ fontSize: 13 }}>{t('finalWarning')}</Typography.Text>

          <div
            style={{
              border: `1px solid ${token.colorErrorBorder}`,
              borderRadius: 8,
              background: token.colorErrorBg,
              padding: 12,
            }}
          >
            <Typography.Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              {t('deleteConfirmationDescription')}
            </Typography.Text>
            <ul style={{ paddingLeft: 18, margin: 0, fontSize: 12, color: token.colorTextSecondary }}>
              <li>{t('deleteConfirmationItem1')}</li>
              <li>{t('deleteConfirmationItem2')}</li>
              <li>{t('deleteConfirmationItem3')}</li>
              <li>{t('deleteConfirmationItem4')}</li>
            </ul>
          </div>

          <Typography.Text type="danger" style={{ fontSize: 12 }}>
            {t('deleteConfirmationWarning')}
          </Typography.Text>
        </Flex>
      </Modal>
    </Flex>
  );
};

export default DangerZoneSection;
