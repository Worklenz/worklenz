import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Empty,
  Flex,
  Image,
  List,
  Modal,
  Skeleton,
  Tag,
  Typography,
  theme,
} from '@/shared/antd-imports';
import { projectTemplatesApiService } from '@/api/project-templates/project-templates.api.service';
import { IProjectTemplate } from '@/types/project-templates/project-templates.types';
import { getTemplateIcon } from './template-icon';
import logger from '@/utils/errorLogger';

const { Text, Title } = Typography;

interface TemplatePreviewDrawerProps {
  templateId: string | null;
  templateName?: string;
  open: boolean;
  onClose: () => void;
  onUseTemplate: (templateId: string) => void;
}

export const TemplatePreviewDrawer = ({
  templateId,
  templateName,
  open,
  onClose,
  onUseTemplate,
}: TemplatePreviewDrawerProps) => {
  const { t } = useTranslation('template-drawer');
  const { token } = theme.useToken();

  const [template, setTemplate] = useState<IProjectTemplate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !templateId) return;
    setTemplate(null);
    setLoading(true);
    projectTemplatesApiService
      .getByTemplateId(templateId)
      .then(res => { if (res.done) setTemplate(res.body); })
      .catch(err => logger.error('Failed to load template preview', err))
      .finally(() => setLoading(false));
  }, [open, templateId]);

  // ─── Exact same renderTemplateDetails as the old TemplateDrawer ──────────
  const renderTemplateDetails = () => {
    if (!template) {
      return <Empty description={t('noTemplateSelected', { defaultValue: 'No template selected' })} />;
    }

    const tagStyle = (colorCode?: string) => ({
      color: token.colorText,
      marginBottom: '8px',
      backgroundColor: colorCode ? undefined : token.colorBgContainer,
      borderColor: colorCode ? undefined : token.colorBorder,
    });

    const detailRow = (label: string, content: React.ReactNode) => (
      <div className="template-detail-row" style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 6 }}>
          <Text strong style={{ color: token.colorText }}>{label}</Text>
        </div>
        <div>{content}</div>
      </div>
    );

    return (
      <div>
        {/* Description */}
        {detailRow(
          t('description', { defaultValue: 'Description' }),
          <Text style={{ color: token.colorText }}>
            {template.description || t('noDescription', { defaultValue: 'No description' })}
          </Text>
        )}

        {/* Phases */}
        {detailRow(
          t('phase', { defaultValue: 'Phases' }),
          template.phases?.length ? (
            <div>
              {template.phases.map(phase => (
                <Tag key={phase.name} color={phase.color_code} style={tagStyle(phase.color_code)}>
                  {phase.name}
                </Tag>
              ))}
            </div>
          ) : (
            <Text type="secondary">{t('noPhases', { defaultValue: 'No phases' })}</Text>
          )
        )}

        {/* Statuses */}
        {detailRow(
          t('statuses', { defaultValue: 'Statuses' }),
          template.status?.length ? (
            <div>
              {template.status.map(status => (
                <Tag key={status.name} color={status.color_code} style={tagStyle(status.color_code)}>
                  {status.name}
                </Tag>
              ))}
            </div>
          ) : (
            <Text type="secondary">{t('noStatuses', { defaultValue: 'No statuses' })}</Text>
          )
        )}

        {/* Priorities */}
        {detailRow(
          t('priorities', { defaultValue: 'Priorities' }),
          template.priorities?.length ? (
            <div>
              {template.priorities.map(priority => (
                <Tag key={priority.name} color={priority.color_code} style={tagStyle(priority.color_code)}>
                  {priority.name}
                </Tag>
              ))}
            </div>
          ) : (
            <Text type="secondary">{t('noPriorities', { defaultValue: 'No priorities' })}</Text>
          )
        )}

        {/* Labels */}
        {detailRow(
          t('labels', { defaultValue: 'Labels' }),
          template.labels?.length ? (
            <div>
              {template.labels.map(label => (
                <Tag key={label.name} color={label.color_code} style={tagStyle(label.color_code)}>
                  {label.name}
                </Tag>
              ))}
            </div>
          ) : (
            <Text type="secondary">{t('noLabels', { defaultValue: 'No labels' })}</Text>
          )
        )}

        {/* Tasks */}
        {detailRow(
          t('tasks', { defaultValue: 'Tasks' }),
          template.tasks?.length ? (
            <List
              size="small"
              dataSource={template.tasks}
              renderItem={item => (
                <List.Item key={item.name} style={{ padding: '4px 0', borderColor: token.colorBorder }}>
                  <Text style={{ color: token.colorText }}>{item.name}</Text>
                </List.Item>
              )}
            />
          ) : (
            <Text type="secondary">{t('noTasks', { defaultValue: 'No tasks' })}</Text>
          )
        )}
      </div>
    );
  };

  const displayName = template?.name ?? templateName ?? '';
  const taskCount = template?.tasks?.length ?? 0;
  const phaseCount = template?.phases?.length ?? 0;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={600}
      styles={{
        body: { padding: 0, maxHeight: '72vh', overflowY: 'auto' },
        content: { padding: 0, overflow: 'hidden' },
      }}
      title={null}
      closable={false}
    >
      {/* ── Header ── */}
      <div
        style={{
          background: token.colorBgElevated,
          padding: '16px 20px 14px',
          borderBottom: `1px solid ${token.colorBorder}`,
        }}
      >
        <Flex align="flex-start" gap={12}>
          {/* Icon */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: token.colorPrimary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            {template?.image_url ? (
              <img
                src={template.image_url}
                alt={displayName}
                style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }}
              />
            ) : (
              getTemplateIcon(displayName)
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <Title level={5} style={{ margin: '0 0 4px', color: token.colorText }}>
              {loading ? '—' : displayName}
            </Title>
            {template?.description && (
              <Text type="secondary" style={{ fontSize: 12 }}>{template.description}</Text>
            )}
            {!loading && (taskCount > 0 || phaseCount > 0) && (
              <Flex gap={12} style={{ marginTop: 4 }}>
                {taskCount > 0 && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <strong>{taskCount}</strong> {t('sampleTasksCount', { defaultValue: 'sample tasks' })}
                  </Text>
                )}
                {phaseCount > 0 && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <strong>{phaseCount}</strong> {t('phases', { defaultValue: 'phases' })}
                  </Text>
                )}
                {(template?.labels?.length ?? 0) > 0 && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <strong>{template!.labels!.length}</strong> {t('labels', { defaultValue: 'labels' })}
                  </Text>
                )}
              </Flex>
            )}
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: token.colorTextSecondary,
              fontSize: 18,
              lineHeight: 1,
              padding: 4,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </Flex>
      </div>

      {/* ── Body — exact same details as old TemplateDrawer ── */}
      <div style={{ padding: '16px 24px' }}>
        <Skeleton active loading={loading} paragraph={{ rows: 8 }}>
          {/* Cover image if present */}
          {template?.image_url && (
            <div style={{ marginBottom: 16 }}>
              <Image
                preview={false}
                src={template.image_url}
                alt={template.name}
                style={{ width: '100%', borderRadius: 8 }}
              />
            </div>
          )}
          {renderTemplateDetails()}
        </Skeleton>
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: `1px solid ${token.colorBorder}`,
          background: token.colorBgContainer,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('customizeAfterCreating', { defaultValue: 'You can customize everything after creating.' })}
        </Text>
        <Flex gap={8}>
          <Button onClick={onClose}>
            {t('closePreview', { defaultValue: 'Close preview' })}
          </Button>
          <Button
            type="primary"
            disabled={!templateId}
            onClick={() => templateId && onUseTemplate(templateId)}
          >
            {t('useTemplate', { defaultValue: 'Use this template' })} →
          </Button>
        </Flex>
      </div>
    </Modal>
  );
};

export default TemplatePreviewDrawer;
