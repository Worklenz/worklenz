import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Flex,
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

// ─── Board preview ──────────────────────────────────────────────────────────
// Groups tasks by status_name and renders a mini kanban board
const BoardPreview = ({ template, token }: { template: IProjectTemplate; token: any }) => {
  const { t } = useTranslation('template-drawer');

  // Build columns: one per unique status
  const columns: Record<string, { tasks: typeof template.tasks; color?: string }> = {};
  (template.status ?? []).forEach(s => {
    if (s.name) columns[s.name] = { tasks: [], color: s.color_code };
  });

  (template.tasks ?? []).forEach(task => {
    const col = task.status_name ?? '';
    if (!columns[col]) columns[col] = { tasks: [] };
    columns[col].tasks!.push(task);
  });

  const colEntries = Object.entries(columns);
  if (colEntries.length === 0) return null;

  return (
    <div>
      <Text strong style={{ fontSize: 12, color: token.colorTextSecondary, display: 'block', marginBottom: 8 }}>
        {t('boardPreview', { defaultValue: 'BOARD PREVIEW' }).toUpperCase()}
      </Text>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(colEntries.length, 4)}, 1fr)`,
          gap: 8,
          marginBottom: 20,
        }}
      >
        {colEntries.map(([statusName, col]) => (
          <div
            key={statusName}
            style={{
              background: token.colorBgElevated,
              border: `1px solid ${token.colorBorder}`,
              borderRadius: 6,
              padding: '8px 8px 4px',
              minHeight: 60,
            }}
          >
            {/* Column header */}
            <Flex justify="space-between" align="center" style={{ marginBottom: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: 600, color: token.colorText }}>
                {statusName}
              </Text>
              <Text style={{ fontSize: 11, color: token.colorTextTertiary }}>
                {col.tasks?.length ?? 0}
              </Text>
            </Flex>
            {/* Task cards — show up to 3 */}
            {(col.tasks ?? []).slice(0, 3).map((task, i) => (
              <div
                key={i}
                style={{
                  background: token.colorBgContainer,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: 4,
                  padding: '4px 6px',
                  marginBottom: 4,
                  fontSize: 11,
                }}
              >
                <Text
                  style={{ fontSize: 11, color: token.colorText }}
                  ellipsis
                >
                  {task.name}
                </Text>
                {task.labels && task.labels.length > 0 && (
                  <div style={{ marginTop: 2 }}>
                    <Tag
                      style={{
                        fontSize: 10,
                        padding: '0 4px',
                        lineHeight: '16px',
                        margin: 0,
                        borderColor: token.colorBorder,
                        background: token.colorFillSecondary,
                        color: token.colorTextSecondary,
                      }}
                    >
                      {task.labels[0].name}
                    </Tag>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Tasks list ─────────────────────────────────────────────────────────────
const TasksList = ({ template, token }: { template: IProjectTemplate; token: any }) => {
  const { t } = useTranslation('template-drawer');
  const tasks = template.tasks ?? [];
  if (tasks.length === 0) return null;

  // Status → color mapping from template.status
  const statusColors: Record<string, string> = {};
  (template.status ?? []).forEach(s => {
    if (s.name && s.color_code) statusColors[s.name] = s.color_code;
  });

  return (
    <div>
      <Text strong style={{ fontSize: 12, color: token.colorTextSecondary, display: 'block', marginBottom: 8 }}>
        {t('sampleTasks', { defaultValue: 'SAMPLE TASKS INCLUDED' }).toUpperCase()}
      </Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {tasks.slice(0, 8).map((task, i) => (
          <Flex
            key={i}
            justify="space-between"
            align="center"
            style={{
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorder}`,
              borderRadius: 4,
              padding: '5px 10px',
            }}
          >
            <Flex align="center" gap={8}>
              {/* Checkbox placeholder */}
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  border: `1.5px solid ${token.colorBorder}`,
                  flexShrink: 0,
                }}
              />
              <Text style={{ fontSize: 12, color: token.colorText }}>{task.name}</Text>
            </Flex>
            {task.status_name && (
              <Text
                style={{
                  fontSize: 11,
                  color: statusColors[task.status_name] ?? token.colorTextSecondary,
                  flexShrink: 0,
                  marginLeft: 8,
                }}
              >
                {task.status_name}
              </Text>
            )}
          </Flex>
        ))}
        {tasks.length > 8 && (
          <Text type="secondary" style={{ fontSize: 11, textAlign: 'center', paddingTop: 4 }}>
            +{tasks.length - 8} {t('moreTasks', { defaultValue: 'more tasks' })}
          </Text>
        )}
      </div>
    </div>
  );
};

// ─── Main component ─────────────────────────────────────────────────────────
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

  const displayName = template?.name ?? templateName ?? '';
  const taskCount = template?.tasks?.length ?? 0;
  const phaseCount = template?.phases?.length ?? 0;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={680}
      styles={{
        body: { padding: 0, maxHeight: '70vh', overflowY: 'auto' },
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
              <img src={template.image_url} alt={displayName} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
            ) : (
              getTemplateIcon(displayName)
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <Text type="secondary" style={{ fontSize: 10, letterSpacing: 1, display: 'block' }}>
              {t('templatePreview', { defaultValue: 'SOFTWARE DEV TEMPLATE' }).toUpperCase()}
            </Text>
            <Title level={4} style={{ margin: '2px 0 4px', color: token.colorText }}>
              {loading ? '—' : displayName}
            </Title>
            {template?.description && (
              <Text type="secondary" style={{ fontSize: 12 }}>{template.description}</Text>
            )}
            {!loading && (taskCount > 0 || phaseCount > 0) && (
              <Flex gap={16} style={{ marginTop: 6 }}>
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

          {/* Close */}
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

      {/* ── Body ── */}
      <div style={{ padding: '16px 20px' }}>
        <Skeleton active loading={loading} paragraph={{ rows: 10 }}>
          {template && (
            <>
              <BoardPreview template={template} token={token} />
              <TasksList template={template} token={token} />
            </>
          )}
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
