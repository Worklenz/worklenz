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

const steps = [
  { label: 'Navigate to a project and open it.' },
  { label: 'Select tasks using the Bulk Edit option.' },
  { label: 'Click More Options in the bulk action bar and choose Create Task Template.' },
];

const TaskTemplatesSettings = () => {
  const { t } = useTranslation('settings/task-templates');
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [taskTemplates, setTaskTemplates] = useState<ITaskTemplatesGetResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const isDark = themeMode === 'dark';

  const svgColors = {
    backPage: { fill: isDark ? '#0d2137' : '#e6f4ff', stroke: isDark ? '#177ddc' : '#91caff' },
    midPage: { fill: isDark ? '#111d2c' : '#bae0ff', stroke: isDark ? '#1890ff' : '#4096ff' },
    frontPage: { fill: isDark ? '#0a1929' : '#ffffff', stroke: '#1890ff' },
    lines: isDark ? '#177ddc' : '#91caff',
    badge: '#1890ff',
    badgePlus: '#ffffff',
    numBadgeBg: isDark ? '#0d2137' : '#e6f4ff',
    numBadgeBdr: isDark ? '#177ddc' : '#91caff',
    numBadgeTxt: '#1890ff',
    connector: isDark ? '#153450' : '#91caff',
  };

  const emptyState = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px 40px', textAlign: 'center' }}>
      <svg width="72" height="72" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: 20 }}>
        <rect x="8" y="16" width="46" height="54" rx="6" fill={svgColors.backPage.fill} stroke={svgColors.backPage.stroke} strokeWidth="1.5" />
        <rect x="20" y="10" width="46" height="54" rx="6" fill={svgColors.midPage.fill} stroke={svgColors.midPage.stroke} strokeWidth="1.5" />
        <rect x="30" y="16" width="40" height="48" rx="5" fill={svgColors.frontPage.fill} stroke={svgColors.frontPage.stroke} strokeWidth="1.5" />
        <line x1="40" y1="30" x2="62" y2="30" stroke={svgColors.lines} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="40" y1="38" x2="62" y2="38" stroke={svgColors.lines} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="40" y1="46" x2="54" y2="46" stroke={svgColors.lines} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="62" cy="58" r="12" fill={svgColors.badge} />
        <line x1="62" y1="52" x2="62" y2="64" stroke={svgColors.badgePlus} strokeWidth="2.2" strokeLinecap="round" />
        <line x1="56" y1="58" x2="68" y2="58" stroke={svgColors.badgePlus} strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <p style={{ fontSize: 15, fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)', margin: '0 0 28px' }}>
        No task templates yet
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 360, textAlign: 'left' }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 24 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: svgColors.numBadgeBg, border: `1px solid ${svgColors.numBadgeBdr}`, color: svgColors.numBadgeTxt, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div style={{ width: 1, height: 32, background: svgColors.connector, margin: '3px 0' }} />
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', minHeight: 24, paddingBottom: i < steps.length - 1 ? 16 : 0 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)' }}>
                {step.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Card style={{ width: '100%' }}>
      <Table
        locale={{ emptyText: isLoading ? null : emptyState }}
        loading={isLoading}
        size="small"
          showHeader={isLoading || taskTemplates.length > 0}
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
