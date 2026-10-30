import React, { useMemo, useState } from 'react';
import {
  Button,
  Dropdown,
  Input,
  Modal,
  Space,
  Typography,
  message,
} from '@/shared/antd-imports';
import {
  DeleteOutlined,
  EditOutlined,
  ShareAltOutlined,
  StarOutlined,
  DownOutlined,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import type { AnalyticsReportTemplate } from '@/types/reporting/analytics-velocity.types';
import { analyticsVelocityApiService } from '@/api/reporting/analytics-velocity.api.service';
import { TEMPLATE_NAME_MAX_LENGTH } from '@/lib/reporting/analytics-constants';

const { Text } = Typography;

interface VelocityTemplatesMenuProps {
  templates: AnalyticsReportTemplate[];
  canShare: boolean;
  onRefresh: () => void;
  onApply: (template: AnalyticsReportTemplate) => void;
}

export const VelocityTemplatesMenu: React.FC<VelocityTemplatesMenuProps> = ({
  templates,
  canShare,
  onRefresh,
  onApply,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => {
    if (!templates.length) {
      return [
        {
          key: 'empty',
          disabled: true,
          label: t('noTemplatesYet', { defaultValue: 'No saved templates yet' }),
        },
      ];
    }

    return templates.map(template => ({
      key: template.id,
      label: (
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <span>
            {template.name}
            {template.is_default
              ? ` (${t('defaultBadge', { defaultValue: 'default' })})`
              : ''}
            {template.is_workspace_shared
              ? ` · ${t('sharedBadge', { defaultValue: 'shared' })}`
              : ''}
          </span>
        </Space>
      ),
      children: [
        {
          key: `${template.id}-apply`,
          label: t('applyTemplate', { defaultValue: 'Apply' }),
          onClick: () => onApply(template),
        },
        {
          key: `${template.id}-rename`,
          icon: <EditOutlined />,
          label: t('renameTemplate', { defaultValue: 'Rename' }),
          onClick: () => {
            setRenameId(template.id);
            setRenameValue(template.name);
            setRenameOpen(true);
          },
        },
        {
          key: `${template.id}-default`,
          icon: <StarOutlined />,
          label: t('setAsDefault', { defaultValue: 'Set as my default' }),
          onClick: async () => {
            try {
              setBusy(true);
              const res = await analyticsVelocityApiService.setDefaultTemplate(template.id);
              if (res.done) {
                message.success(
                  t('templateDefaultSet', { defaultValue: 'Default template updated' })
                );
                onRefresh();
              } else {
                message.error(res.message || t('templateActionFailed', { defaultValue: 'Action failed' }));
              }
            } catch {
              message.error(t('templateActionFailed', { defaultValue: 'Action failed' }));
            } finally {
              setBusy(false);
            }
          },
        },
        ...(canShare
          ? [
              {
                key: `${template.id}-share`,
                icon: <ShareAltOutlined />,
                label: template.is_workspace_shared
                  ? t('unshareTemplate', { defaultValue: 'Unshare' })
                  : t('shareTemplate', { defaultValue: 'Share with workspace' }),
                onClick: async () => {
                  try {
                    setBusy(true);
                    const res = await analyticsVelocityApiService.setTemplateShare(
                      template.id,
                      !template.is_workspace_shared
                    );
                    if (res.done) {
                      message.success(
                        t('templateShareUpdated', { defaultValue: 'Sharing updated' })
                      );
                      onRefresh();
                    } else {
                      message.error(
                        res.message || t('templateActionFailed', { defaultValue: 'Action failed' })
                      );
                    }
                  } catch {
                    message.error(t('templateActionFailed', { defaultValue: 'Action failed' }));
                  } finally {
                    setBusy(false);
                  }
                },
              },
            ]
          : []),
        {
          key: `${template.id}-delete`,
          icon: <DeleteOutlined />,
          danger: true,
          label: t('deleteTemplate', { defaultValue: 'Delete' }),
          onClick: () => {
            Modal.confirm({
              title: t('deleteTemplateConfirm', {
                defaultValue: 'Delete this template?',
              }),
              okType: 'danger',
              onOk: async () => {
                const res = await analyticsVelocityApiService.deleteTemplate(template.id);
                if (res.done) {
                  message.success(t('templateDeleted', { defaultValue: 'Template deleted' }));
                  onRefresh();
                } else {
                  message.error(
                    res.message || t('templateActionFailed', { defaultValue: 'Action failed' })
                  );
                }
              },
            });
          },
        },
      ],
    }));
  }, [templates, canShare, onApply, onRefresh, t]);

  const handleRename = async () => {
    if (!renameId || !renameValue.trim()) return;
    try {
      setBusy(true);
      const res = await analyticsVelocityApiService.renameTemplate(
        renameId,
        renameValue.trim()
      );
      if (res.done) {
        message.success(t('templateRenamed', { defaultValue: 'Template renamed' }));
        setRenameOpen(false);
        onRefresh();
      } else {
        message.error(res.message || t('templateActionFailed', { defaultValue: 'Action failed' }));
      }
    } catch {
      message.error(t('templateActionFailed', { defaultValue: 'Action failed' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dropdown menu={{ items }} trigger={['click']} disabled={busy}>
        <Button>
          {t('myTemplates', { defaultValue: 'My Templates' })}
          <DownOutlined />
        </Button>
      </Dropdown>

      <Modal
        open={renameOpen}
        title={t('renameTemplate', { defaultValue: 'Rename' })}
        onCancel={() => setRenameOpen(false)}
        onOk={handleRename}
        confirmLoading={busy}
        okText={t('saveTemplate', { defaultValue: 'Save' })}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          {t('templateName', { defaultValue: 'Template name' })}
        </Text>
        <Input
          value={renameValue}
          maxLength={TEMPLATE_NAME_MAX_LENGTH}
          onChange={e => setRenameValue(e.target.value)}
        />
      </Modal>
    </>
  );
};
