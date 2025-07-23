import { Timeline, Typography, Flex, ConfigProvider, Tag, Tooltip, Skeleton } from '@/shared/antd-imports';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightOutlined } from '@/shared/antd-imports';

import {
  IActivityLog,
  IActivityLogAttributeTypes,
  IActivityLogsResponse,
} from '@/types/tasks/task-activity-logs-get-request';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { taskActivityLogsApiService } from '@/api/tasks/task-activity-logs.api.service';
import { useAppSelector } from '@/hooks/useAppSelector';
import { calculateTimeGap } from '@/utils/calculate-time-gap';
import { formatDateTimeWithLocale } from '@/utils/format-date-time-with-locale';
import logger from '@/utils/errorLogger';

const TaskDrawerActivityLog = () => {
  const [activityLogs, setActivityLogs] = useState<IActivityLogsResponse>({});
  const [loading, setLoading] = useState<boolean>(false);
  const { selectedTaskId, taskFormViewModel } = useAppSelector(state => state.taskDrawerReducer);
  const { mode: themeMode } = useAppSelector(state => state.themeReducer);
  const { t } = useTranslation('task-drawer/task-drawer');

  useEffect(() => {
    fetchActivityLogs();
  }, [taskFormViewModel]);

  const fetchActivityLogs = async () => {
    if (!selectedTaskId) return;
    setLoading(true);
    try {
      const res = await taskActivityLogsApiService.getActivityLogsByTaskId(selectedTaskId);
      if (res.done) {
        setActivityLogs(res.body);
      }
    } catch (error) {
      logger.error('Error fetching activity logs', error);
    } finally {
      setLoading(false);
    }
  };

  const renderAttributeType = (activity: IActivityLog) => {
    const truncateText = (text?: string) => {
      if (!text) return text;
      const div = document.createElement('div');
      div.innerHTML = text;
      const plainText = div.textContent || div.innerText || '';
      return plainText.length > 28 ? `${plainText.slice(0, 27)}...` : plainText;
    };

    switch (activity.attribute_type) {
      case IActivityLogAttributeTypes.ASSIGNEES:
        return (
          <Flex gap={4} align="center">
            <SingleAvatar
              avatarUrl={activity.assigned_user?.avatar_url}
              name={activity.assigned_user?.name}
            />
            <Typography.Text>{truncateText(activity.assigned_user?.name)}</Typography.Text>
            <ArrowRightOutlined />
            &nbsp;
            <Tag color={'default'}>{truncateText(activity.log_type?.toUpperCase())}</Tag>
          </Flex>
        );

      case IActivityLogAttributeTypes.LABEL:
        return (
          <Flex gap={4} align="center">
            <Tag color={activity.label_data?.color_code}>
              {truncateText(activity.label_data?.name)}
            </Tag>
            <ArrowRightOutlined />
            &nbsp;
            <Tag color={'default'}>{activity.log_type === 'create' ? t('taskActivityLogTab.add') : t('taskActivityLogTab.remove')}</Tag>
          </Flex>
        );

      case IActivityLogAttributeTypes.STATUS:
        return (
          <Flex gap={4} align="center">
            <Tag
              color={
                themeMode === 'dark'
                  ? activity.previous_status?.color_code_dark
                  : activity.previous_status?.color_code
              }
            >
              {truncateText(activity.previous_status?.name) || t('taskActivityLogTab.none')}
            </Tag>
            <ArrowRightOutlined />
            &nbsp;
            <Tag
              color={
                themeMode === 'dark'
                  ? activity.next_status?.color_code_dark
                  : activity.next_status?.color_code
              }
            >
              {truncateText(activity.next_status?.name) || t('taskActivityLogTab.none')}
            </Tag>
          </Flex>
        );

      case IActivityLogAttributeTypes.PRIORITY:
        return (
          <Flex gap={4} align="center">
            <Tag
              color={
                themeMode === 'dark'
                  ? activity.previous_priority?.color_code_dark
                  : activity.previous_priority?.color_code
              }
            >
              {truncateText(activity.previous_priority?.name) || t('taskActivityLogTab.none')}
            </Tag>
            <ArrowRightOutlined />
            &nbsp;
            <Tag
              color={
                themeMode === 'dark'
                  ? activity.next_priority?.color_code_dark
                  : activity.next_priority?.color_code
              }
            >
              {truncateText(activity.next_priority?.name) || t('taskActivityLogTab.none')}
            </Tag>
          </Flex>
        );

      case IActivityLogAttributeTypes.PHASE:
        return (
          <Flex gap={4} align="center">
            <Tag color={activity.previous_phase?.color_code}>
              {truncateText(activity.previous_phase?.name) || t('taskActivityLogTab.none')}
            </Tag>
            <ArrowRightOutlined />
            &nbsp;
            <Tag color={activity.next_phase?.color_code}>
              {truncateText(activity.next_phase?.name) || t('taskActivityLogTab.none')}
            </Tag>
          </Flex>
        );

      case IActivityLogAttributeTypes.PROGRESS:
        return (
          <Flex gap={4} align="center">
            <Tag color="blue">{activity.previous || '0'}%</Tag>
            <ArrowRightOutlined />
            &nbsp;
            <Tag color="blue">{activity.current || '0'}%</Tag>
          </Flex>
        );

      case IActivityLogAttributeTypes.WEIGHT:
        return (
          <Flex gap={4} align="center">
            <Tag color="purple">{t('taskActivityLogTab.weight')}: {activity.previous || '100'}</Tag>
            <ArrowRightOutlined />
            &nbsp;
            <Tag color="purple">{t('taskActivityLogTab.weight')}: {activity.current || '100'}</Tag>
          </Flex>
        );

      default:
        return (
          <Flex gap={4} align="center">
            <Tag color={'default'}>{truncateText(activity.previous) || t('taskActivityLogTab.none')}</Tag>
            <ArrowRightOutlined />
            &nbsp;
            <Tag color={'default'}>{truncateText(activity.current) || t('taskActivityLogTab.none')}</Tag>
          </Flex>
        );
    }
  };

  useEffect(() => {
    !loading && fetchActivityLogs();
  }, []);

  return (
    <ConfigProvider
      theme={{
        components: {
          Timeline: { itemPaddingBottom: 32, dotBorderWidth: '1.5px' },
        },
      }}
    >
      <Skeleton active loading={loading}>
        <Timeline style={{ marginBlockStart: 24 }}>
          {activityLogs.logs?.map((activity, index) => (
            <Timeline.Item key={index}>
              <Flex gap={8} align="center">
                <SingleAvatar
                  avatarUrl={activity.done_by?.avatar_url}
                  name={activity.done_by?.name}
                />
                <Flex vertical gap={4}>
                  <Flex gap={4} align="center">
                    <Typography.Text strong>{activity.done_by?.name}</Typography.Text>
                    <Typography.Text>{activity.log_text}</Typography.Text>
                    <Typography.Text strong>{activity.attribute_type}.</Typography.Text>
                    <Tooltip
                      title={
                        activity.created_at ? formatDateTimeWithLocale(activity.created_at) : ''
                      }
                    >
                      <Typography.Text strong type="secondary">
                        {activity.created_at ? calculateTimeGap(activity.created_at) : ''}
                      </Typography.Text>
                    </Tooltip>
                  </Flex>
                  {renderAttributeType(activity)}
                </Flex>
              </Flex>
            </Timeline.Item>
          ))}
          <Timeline.Item>
            <Flex gap={8} align="center">
              <SingleAvatar avatarUrl={activityLogs.avatar_url} name={activityLogs.name} />
              <Flex vertical gap={4}>
                <Flex gap={4} align="center">
                  <Typography.Text strong>{activityLogs.name}</Typography.Text>
                  <Typography.Text>{t('taskActivityLogTab.createdTask')}</Typography.Text>
                  <Tooltip
                    title={
                      activityLogs.created_at
                        ? formatDateTimeWithLocale(activityLogs.created_at)
                        : ''
                    }
                  >
                    <Typography.Text strong type="secondary">
                      {activityLogs.created_at ? calculateTimeGap(activityLogs.created_at) : ''}
                    </Typography.Text>
                  </Tooltip>
                </Flex>
              </Flex>
            </Flex>
          </Timeline.Item>
        </Timeline>
      </Skeleton>
    </ConfigProvider>
  );
};

export default TaskDrawerActivityLog;
