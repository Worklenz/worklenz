import {
  Button,
  Card,
  Popconfirm,
  Table,
  TableProps,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './task-templates-settings.css';
import { DeleteOutlined, EditOutlined } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import TaskTemplateDrawer from '@/components/task-templates/task-template-drawer';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { ITaskTemplatesGetResponse } from '@/types/settings/task-templates.types';
import logger from '@/utils/errorLogger';
import { taskTemplatesApiService } from '@/api/task-templates/task-templates.api.service';
import { calculateTimeGap } from '@/utils/calculate-time-gap';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_settings_task_templates_visit } from '@/shared/worklenz-analytics-events';

const TaskTemplatesSettings = () => {
  const { t } = useTranslation('settings/task-templates');
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [taskTemplates, setTaskTemplates] = useState<ITaskTemplatesGetResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const { trackMixpanelEvent } = useMixpanelTracking();
  useDocumentTitle('Task Templates');

  const fetchTaskTemplates = async () => {
    try {
      setIsLoading(true);
      const res = await taskTemplatesApiService.getTemplates();
      setTaskTemplates(res.body);
    } catch (error) {
      logger.error('Failed to fetch task templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    trackMixpanelEvent(evt_settings_task_templates_visit);
    fetchTaskTemplates();
  }, [trackMixpanelEvent]);

  const handleDeleteTemplate = async (id: string) => {
    try {
      setIsLoading(true);
      await taskTemplatesApiService.deleteTemplate(id);
      await fetchTaskTemplates();
    } catch (error) {
      logger.error('Failed to delete task template:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const columns: TableProps<ITaskTemplatesGetResponse>['columns'] = [
    {
      key: 'name',
      title: t('nameColumn'),
      dataIndex: 'name',
    },
    {
      key: 'created',
      title: t('createdColumn'),
      dataIndex: 'created_at',
      render: (date: string) => calculateTimeGap(date),
    },
    {
      key: 'actions',
      width: 120,
      render: record => (
        <div
          style={{ display: 'flex', gap: '10px', justifyContent: 'right' }}
          className="button-visibilty"
        >
          <Tooltip title={t('editToolTip')}>
            <Button size="small" onClick={() => setTemplateId(record.id)}>
              <EditOutlined />
            </Button>
          </Tooltip>
          <Tooltip title={t('deleteToolTip')}>
            <Popconfirm
              title={
                <Typography.Text style={{ fontWeight: 400 }}>{t('confirmText')}</Typography.Text>
              }
              okText={t('okText')}
              cancelText={t('cancelText')}
              onConfirm={() => handleDeleteTemplate(record.id)}
            >
              <Button size="small">
                <DeleteOutlined />
              </Button>
            </Popconfirm>
          </Tooltip>
        </div>
      ),
    },
  ];

  useEffect(() => {
    if (templateId) {
      setShowDrawer(true);
    }
  }, [templateId]);

  const handleCloseDrawer = () => {
    setTemplateId(null);
    setShowDrawer(false);
    fetchTaskTemplates();
  };

  return (
    <Card style={{ width: '100%' }}>
      <Table
        loading={isLoading}
        size="small"
        pagination={{
          size: 'small',
          showSizeChanger: true,
          showTotal: total => t('totalItems', { total }),
        }}
        columns={columns}
        dataSource={taskTemplates}
        rowKey="id"
        rowClassName={(_, index) =>
          `no-border-row ${index % 2 === 0 ? '' : themeMode === 'dark' ? 'dark-alternate-row-color' : 'alternate-row-color'}`
        }
      />
      <TaskTemplateDrawer
        showDrawer={showDrawer}
        selectedTemplateId={templateId}
        onClose={handleCloseDrawer}
      />
    </Card>
  );
};

export default TaskTemplatesSettings;
