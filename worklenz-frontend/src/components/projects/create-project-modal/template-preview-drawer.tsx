import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  CloseOutlined,
  Divider,
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

const { Text, Title, Paragraph } = Typography;

interface TemplatePreviewDrawerProps {
  templateId: string | null;
  templateName?: string;
  open: boolean;
  onClose: () => void;
  onUseTemplate: (templateId: string) => void;
  templateType?: 'worklenz' | 'custom';
}

// ─── Detail row: fixed-width label + content ─────────────────────────────────
const DetailRow = ({
  label,
  children,
  token,
}: {
  label: string;
  children: React.ReactNode;
  token: any;
}) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '110px 1fr',
      gap: '8px 16px',
      alignItems: 'flex-start',
      padding: '10px 0',
      borderBottom: `1px solid ${token.colorBorderSecondary}`,
    }}
  >
    <Text
      strong
      style={{
        fontSize: 13,
        color: token.colorTextSecondary,
        paddingTop: 2,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Text>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {children}
    </div>
  </div>
);

export const TemplatePreviewDrawer = ({
  templateId,
  templateName,
  open,
  onClose,
  onUseTemplate,
  templateType = 'worklenz',
}: TemplatePreviewDrawerProps) => {
  const { t } = useTranslation('template-drawer');
  const { token } = theme.useToken();

  const [template, setTemplate] = useState<IProjectTemplate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !templateId) return;
    setTemplate(null);
    setLoading(true);

    const fetchTemplate = async () => {
      try {
        let res;
        if (templateType === 'custom') {
          res = await projectTemplatesApiService.getCustomTemplateById(templateId);
        } else {
          res = await projectTemplatesApiService.getByTemplateId(templateId);
        }
        if (res.done) setTemplate(res.body);
      } catch (err) {
        logger.error('Failed to load template preview', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTemplate();
  }, [open, templateId, templateType]);

  const tagStyle = (colorCode?: string) => ({
    color: token.colorText,
    margin: 0,
    backgroundColor: colorCode ? undefined : token.colorBgContainer,
    borderColor: colorCode ? undefined : token.colorBorder,
  });

  const noValue = (msg: string) => (
    <Text type="secondary" style={{ fontSize: 13 }}>{msg}</Text>
  );

  const displayName = template?.name ?? templateName ?? '';
  const taskCount   = template?.tasks?.length ?? 0;
  const phaseCount  = template?.phases?.length ?? 0;
  const labelCount  = template?.labels?.length ?? 0;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={780}
      styles={{
        body:    { padding: 0 },
        content: { padding: 0, overflow: 'hidden', borderRadius: 8 },
        mask:    { backdropFilter: 'blur(2px)' },
      }}
      title={null}
      closable={false}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: token.colorBgElevated,
          padding: '20px 24px 16px',
          borderBottom: `1px solid ${token.colorBorder}`,
        }}
      >
        <Flex align="flex-start" gap={14} justify="space-between">
          <Flex align="flex-start" gap={14} style={{ flex: 1, minWidth: 0 }}>

            {/* Name + meta */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Title
                level={4}
                style={{ margin: '0 0 4px', color: token.colorText, lineHeight: 1.3 }}
              >
                {loading ? '—' : displayName}
              </Title>

              {template?.description && (
                <Paragraph
                  type="secondary"
                  style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.5 }}
                  ellipsis={{ rows: 2, expandable: true }}
                >
                  {template.description}
                </Paragraph>
              )}

              {/* Stat pills */}
              {!loading && (taskCount > 0 || phaseCount > 0 || labelCount > 0) && (
                <Flex gap={16} wrap="wrap">
                  {taskCount > 0 && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <strong style={{ color: token.colorText }}>{taskCount}</strong>{' '}
                      {t('sampleTasksCount', { defaultValue: 'sample tasks' })}
                    </Text>
                  )}
                  {phaseCount > 0 && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <strong style={{ color: token.colorText }}>{phaseCount}</strong>{' '}
                      {t('phases', { defaultValue: 'phases' })}
                    </Text>
                  )}
                  {labelCount > 0 && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <strong style={{ color: token.colorText }}>{labelCount}</strong>{' '}
                      {t('labels', { defaultValue: 'labels' })}
                    </Text>
                  )}
                </Flex>
              )}
            </div>
          </Flex>

          {/* Close */}
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={onClose}
            style={{ color: token.colorTextSecondary, flexShrink: 0 }}
            aria-label="Close"
          />
        </Flex>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '8px 24px 20px',
          maxHeight: '60vh',
          overflowY: 'auto',
          background: token.colorBgContainer,
        }}
      >
        <Skeleton active loading={loading} paragraph={{ rows: 10 }}>
          {!template ? (
            <Empty
              description={t('noTemplateSelected', { defaultValue: 'No template selected' })}
              style={{ padding: '32px 0' }}
            />
          ) : (
            <>
              {/* Cover image */}
              {template.image_url && (
                <div style={{ marginBottom: 16, marginTop: 16 }}>
                  <Image
                    preview={false}
                    src={template.image_url}
                    alt={template.name}
                    style={{ width: '100%', borderRadius: 8 }}
                  />
                </div>
              )}

              <div style={{ marginTop: 8 }}>
                {/* Description */}
                <DetailRow label={t('description', { defaultValue: 'Description' })} token={token}>
                  <Text style={{ fontSize: 13, color: token.colorText, lineHeight: 1.6 }}>
                    {template.description ||
                      noValue(t('noDescription', { defaultValue: 'No description' }))}
                  </Text>
                </DetailRow>

                {/* Phases */}
                <DetailRow label={t('phase', { defaultValue: 'Phases' })} token={token}>
                  {template.phases?.length
                    ? template.phases.map(p => (
                        <Tag key={p.name} color={p.color_code} style={tagStyle(p.color_code)}>
                          {p.name}
                        </Tag>
                      ))
                    : noValue(t('noPhases', { defaultValue: 'No phases' }))}
                </DetailRow>

                {/* Statuses */}
                <DetailRow label={t('statuses', { defaultValue: 'Statuses' })} token={token}>
                  {template.status?.length
                    ? template.status.map(s => (
                        <Tag key={s.name} color={s.color_code} style={tagStyle(s.color_code)}>
                          {s.name}
                        </Tag>
                      ))
                    : noValue(t('noStatuses', { defaultValue: 'No statuses' }))}
                </DetailRow>

                {/* Priorities */}
                <DetailRow label={t('priorities', { defaultValue: 'Priorities' })} token={token}>
                  {template.priorities?.length
                    ? template.priorities.map(p => (
                        <Tag key={p.name} color={p.color_code} style={tagStyle(p.color_code)}>
                          {p.name}
                        </Tag>
                      ))
                    : noValue(t('noPriorities', { defaultValue: 'No priorities' }))}
                </DetailRow>

                {/* Labels */}
                <DetailRow label={t('labels', { defaultValue: 'Labels' })} token={token}>
                  {template.labels?.length
                    ? template.labels.map(l => (
                        <Tag key={l.name} color={l.color_code} style={tagStyle(l.color_code)}>
                          {l.name}
                        </Tag>
                      ))
                    : noValue(t('noLabels', { defaultValue: 'No labels' }))}
                </DetailRow>

                {/* Tasks */}
                <DetailRow label={t('tasks', { defaultValue: 'Tasks' })} token={token}>
                  {template.tasks?.length ? (
                    <List
                      size="small"
                      dataSource={template.tasks}
                      style={{ width: '100%' }}
                      renderItem={item => (
                        <List.Item
                          style={{
                            padding: '5px 0',
                            borderBottom: `1px solid ${token.colorBorderSecondary}`,
                          }}
                        >
                          <Text style={{ fontSize: 13, color: token.colorText }}>
                            {item.name}
                          </Text>
                        </List.Item>
                      )}
                    />
                  ) : (
                    noValue(t('noTasks', { defaultValue: 'No tasks' }))
                  )}
                </DetailRow>
              </div>
            </>
          )}
        </Skeleton>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '12px 24px',
          borderTop: `1px solid ${token.colorBorder}`,
          background: token.colorBgElevated,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('customizeAfterCreating', {
            defaultValue: 'You can customize everything after creating.',
          })}
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
