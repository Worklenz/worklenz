import React, { useEffect, useState } from 'react';
import {
  Modal,
  Button,
  Tag,
  List,
  Typography,
  Skeleton,
  Empty,
  Space,
  Flex,
  theme,
  Divider,
  Input,
  Form,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { projectTemplatesApiService } from '@/api/project-templates/project-templates.api.service';
import { IProjectTemplate } from '@/types/project-templates/project-templates.types';
import logger from '@/utils/errorLogger';

interface ProjectTemplatePreviewModalProps {
  visible: boolean;
  templateId: string | null;
  templateName: string;
  onClose: () => void;
  onImport: (templateId: string, projectName: string) => void;
  importing?: boolean;
}

const { Text, Title } = Typography;

export const ProjectTemplatePreviewModal: React.FC<ProjectTemplatePreviewModalProps> = ({
  visible,
  templateId,
  templateName,
  onClose,
  onImport,
  importing = false,
}) => {
  const { t } = useTranslation('settings/project-templates');
  const { token } = theme.useToken();
  const [template, setTemplate] = useState<IProjectTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (!visible || !templateId) return;
    setTemplate(null);
    setConfirmStep(false);
    setProjectName('');
    setNameError('');
    setLoading(true);
    projectTemplatesApiService
      .getCustomTemplateById(templateId)
      .then(res => {
        if (res.done) setTemplate(res.body);
      })
      .catch(err => logger.error('Failed to load template preview:', err))
      .finally(() => setLoading(false));
  }, [visible, templateId]);

  // Pre-fill the name input with the template name when entering confirm step
  const handleImportClick = () => {
    setProjectName(templateName);
    setNameError('');
    setConfirmStep(true);
  };

  const handleConfirmImport = () => {
    const trimmed = projectName.trim();
    if (!trimmed) {
      setNameError(t('projectNameRequired'));
      return;
    }
    if (!templateId) return;
    onImport(templateId, trimmed);
  };

  const handleBack = () => {
    setConfirmStep(false);
    setNameError('');
  };

  const handleClose = () => {
    setConfirmStep(false);
    setProjectName('');
    setNameError('');
    onClose();
  };

  const renderSection = (
    label: string,
    items: { name?: string; color_code?: string }[] | undefined,
    emptyKey: string
  ) => (
    <div style={{ marginBottom: 16 }}>
      <Text strong style={{ display: 'block', marginBottom: 6 }}>
        {label}
      </Text>
      {items?.length ? (
        <Flex wrap="wrap" gap={6}>
          {items.map((item, i) => (
            <Tag
              key={`${item.name}-${i}`}
              color={item.color_code || undefined}
              style={{
                color: token.colorText,
                backgroundColor: item.color_code ? undefined : token.colorFillAlter,
                borderColor: item.color_code ? undefined : token.colorBorder,
              }}
            >
              {item.name}
            </Tag>
          ))}
        </Flex>
      ) : (
        <Text type="secondary">{t(emptyKey)}</Text>
      )}
    </div>
  );

  const tasks = template?.tasks ?? [];
  const rootTasks = tasks.filter((t: any) => !t.parent_task_id);
  const subTaskMap: Record<string, any[]> = {};
  tasks.forEach((t: any) => {
    if (t.parent_task_id) {
      if (!subTaskMap[t.parent_task_id]) subTaskMap[t.parent_task_id] = [];
      subTaskMap[t.parent_task_id].push(t);
    }
  });

  return (
    <Modal
      title={
        <Space>
          <Title level={5} style={{ margin: 0 }}>
            {confirmStep ? t('importAsTitle') : `${t('previewTitle')}: ${templateName}`}
          </Title>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      width={640}
      centered
      destroyOnHidden
      footer={
        confirmStep ? (
          <Flex justify="space-between" align="center">
            <Button onClick={handleBack} disabled={importing}>
              {t('backToPreview')}
            </Button>
            <Flex gap={8}>
              <Button onClick={handleClose} disabled={importing}>
                {t('cancelText')}
              </Button>
              <Button
                type="primary"
                loading={importing}
                onClick={handleConfirmImport}
              >
                {t('confirmImport')}
              </Button>
            </Flex>
          </Flex>
        ) : (
          <Flex justify="flex-end" gap={8}>
            <Button onClick={handleClose}>{t('cancelText')}</Button>
            <Button
              type="primary"
              disabled={!templateId || loading}
              onClick={handleImportClick}
            >
              {t('importTemplate')}
            </Button>
          </Flex>
        )
      }
    >
      {confirmStep ? (
        /* ── Name entry step ── */
        <div style={{ padding: '8px 0' }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            {t('importNameHint')}
          </Text>
          <Form layout="vertical">
            <Form.Item
              label={t('projectNameLabel')}
              validateStatus={nameError ? 'error' : ''}
              help={nameError || ''}
              required
            >
              <Input
                autoFocus
                value={projectName}
                onChange={e => {
                  setProjectName(e.target.value);
                  if (nameError) setNameError('');
                }}
                onPressEnter={handleConfirmImport}
                placeholder={t('projectNamePlaceholder')}
                maxLength={100}
                showCount
                disabled={importing}
              />
            </Form.Item>
          </Form>
        </div>
      ) : (
        /* ── Preview step ── */
        <Skeleton active loading={loading} paragraph={{ rows: 8 }}>
          {!template ? (
            <Empty description={t('noTemplateData')} />
          ) : (
            <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
              {template.description && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ display: 'block', marginBottom: 4 }}>
                      {t('previewDescription')}
                    </Text>
                    <Text type="secondary">{template.description}</Text>
                  </div>
                  <Divider style={{ margin: '8px 0 16px' }} />
                </>
              )}

              {renderSection(t('previewPhases'), template.phases, 'noPhases')}
              {renderSection(t('previewStatuses'), template.status, 'noStatuses')}
              {renderSection(t('previewLabels'), template.labels, 'noLabels')}

              <Divider style={{ margin: '8px 0 16px' }} />

              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('previewTasks')} ({tasks.length})
                </Text>
                {rootTasks.length ? (
                  <List
                    size="small"
                    dataSource={rootTasks}
                    renderItem={(task: any) => (
                      <React.Fragment key={task.original_task_id ?? task.id ?? task.name}>
                        <List.Item style={{ padding: '6px 8px', borderBottom: 'none' }}>
                          <Flex gap={8} align="center">
                            <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>▸</span>
                            <Text>{task.name}</Text>
                          </Flex>
                        </List.Item>
                        {(subTaskMap[task.original_task_id ?? task.id] ?? []).map((sub: any) => (
                          <List.Item
                            key={sub.original_task_id ?? sub.id ?? sub.name}
                            style={{ padding: '4px 8px 4px 32px', borderBottom: 'none' }}
                          >
                            <Flex gap={8} align="center">
                              <span style={{ color: token.colorTextTertiary, fontSize: 11 }}>↳</span>
                              <Text type="secondary" style={{ fontSize: 13 }}>{sub.name}</Text>
                            </Flex>
                          </List.Item>
                        ))}
                      </React.Fragment>
                    )}
                  />
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t('noTasks')}
                    style={{ margin: '8px 0' }}
                  />
                )}
              </div>
            </div>
          )}
        </Skeleton>
      )}
    </Modal>
  );
};

export default ProjectTemplatePreviewModal;
