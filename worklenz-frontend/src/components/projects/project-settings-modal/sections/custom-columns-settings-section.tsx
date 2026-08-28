import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Empty,
  Flex,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
  PlusOutlined,
  EditOutlined,
  CrownOutlined,
} from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchCustomColumns } from '@/features/task-management/task-management.slice';
import { selectCustomColumns } from '@/features/task-management/task-management.selectors';
import { setCustomColumnModalAttributes } from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import CustomColumnFormContent from '@/pages/projects/projectView/taskList/task-list-table/custom-columns/custom-column-modal/custom-column-form-content';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess, isFreeUser } from '@/ee/utils/subscription-utils';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { LICENSING_SETTINGS } from '@/shared/licensing_settings';
import type { ITaskListColumn } from '@/types/tasks/taskList.types';

interface CustomColumnsSettingsSectionProps {
  projectId?: string | null;
}

const CustomColumnsSettingsSection = ({ projectId }: CustomColumnsSettingsSectionProps) => {
  const { t } = useTranslation('project-drawer');
  const { t: tTable } = useTranslation('task-list-table');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const currentSession = useAuthService().getCurrentSession();
  const isFree = isFreeUser(currentSession);
  const hasBusinessAccess = hasBusinessFeatureAccess(currentSession);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const customColumns = useAppSelector(selectCustomColumns);
  const hasReachedCustomFieldLimit =
    !hasBusinessAccess && customColumns.length >= LICENSING_SETTINGS.CUSTOM_FIELDS_LIMIT;

  useEffect(() => {
    if (projectId) {
      dispatch(fetchCustomColumns(projectId));
    }
  }, [dispatch, projectId]);

  const closeForms = () => {
    setEditingKey(null);
    setIsAdding(false);
  };

  const handleAddColumn = () => {
    if (isFree || hasReachedCustomFieldLimit) {
      dispatch(toggleUpgradeModal());
      return;
    }
    dispatch(setCustomColumnModalAttributes({ modalType: 'create', columnId: null }));
    setEditingKey(null);
    setIsAdding(true);
  };

  const handleEditColumn = (columnKey?: string) => {
    if (!columnKey) return;
    dispatch(setCustomColumnModalAttributes({ modalType: 'edit', columnId: columnKey }));
    setIsAdding(false);
    setEditingKey(prev => (prev === columnKey ? null : columnKey));
  };

  const addButtonTooltip = hasReachedCustomFieldLimit
    ? t('customFieldLimitReached', {
        defaultValue: 'Custom field limit reached. Upgrade to add more.',
      })
    : isFree
      ? t('upgrade-plan', { defaultValue: 'Upgrade plan' })
      : undefined;

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="flex-start">
        <div>
          <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
            {t('customColumnsSectionTitle', { defaultValue: 'Custom Columns' })}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
            {t('customColumnsSectionDescription', {
              defaultValue: 'Extra fields shown as columns on the task list for this project.',
            })}
          </Typography.Paragraph>
        </div>
        <Tooltip title={addButtonTooltip}>
          <Button
            icon={isFree ? <CrownOutlined style={{ color: '#faad14' }} /> : <PlusOutlined />}
            onClick={handleAddColumn}
          >
            {t('addColumn', { defaultValue: 'Add Column' })}
          </Button>
        </Tooltip>
      </Flex>

      {isAdding && (
        <div
          style={{
            borderRadius: 8,
            border: `1px solid ${token.colorBorderSecondary}`,
            padding: 16,
          }}
        >
          <CustomColumnFormContent
            key="__add__"
            projectId={projectId || undefined}
            onDone={closeForms}
          />
        </div>
      )}

      {customColumns.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('noCustomColumns', { defaultValue: 'No custom columns yet' })}
        />
      ) : (
        <Table<ITaskListColumn>
          size="small"
          rowKey="key"
          pagination={false}
          dataSource={customColumns}
          showHeader
          style={{
            borderRadius: 8,
            overflow: 'hidden',
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
          expandable={{
            expandedRowKeys: editingKey ? [editingKey] : [],
            showExpandColumn: false,
            expandedRowRender: record => (
              <CustomColumnFormContent
                key={record.key}
                projectId={projectId || undefined}
                onDone={closeForms}
              />
            ),
          }}
          columns={[
            {
              title: t('customColumnNameHeader', { defaultValue: 'Name' }),
              dataIndex: 'name',
              key: 'name',
              render: (name: string) => (
                <Typography.Text style={{ fontSize: 13, fontWeight: 500 }}>{name}</Typography.Text>
              ),
            },
            {
              title: t('customColumnTypeHeader', { defaultValue: 'Type' }),
              key: 'type',
              width: 140,
              render: (_, record) => {
                const fieldType = record.custom_column_obj?.fieldType;
                if (!fieldType) return null;
                return (
                  <Tag style={{ margin: 0 }}>
                    {tTable(`customColumns.fieldTypes.${fieldType}`, { defaultValue: fieldType })}
                  </Tag>
                );
              },
            },
            {
              key: 'actions',
              width: 56,
              align: 'right',
              render: (_, record) => (
                <Tooltip title={t('editTooltip', { defaultValue: 'Edit' })}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEditColumn(record.key)}
                  />
                </Tooltip>
              ),
            },
          ]}
        />
      )}
    </Flex>
  );
};

export default CustomColumnsSettingsSection;
