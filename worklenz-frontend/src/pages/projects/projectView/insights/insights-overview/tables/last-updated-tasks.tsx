import { Flex, Table, Tooltip, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '@/styles/colors';
import { TableProps } from 'antd/lib';
import { simpleDateFormat } from '@/utils/simpleDateFormat';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IInsightTasks } from '@/types/project/projectInsights.types';
import { projectInsightsApiService } from '@/api/projects/insights/project-insights.api.service';
import logger from '@/utils/errorLogger';
import { formatDateTimeWithLocale } from '@/utils/format-date-time-with-locale';
import { calculateTimeDifference } from '@/utils/calculate-time-difference';

const LastUpdatedTasks = () => {
  const { t } = useTranslation('project-view-insights');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { includeArchivedTasks, projectId } = useAppSelector(state => state.projectInsightsReducer);

  const [data, setData] = useState<IInsightTasks[]>([]);
  const [loading, setLoading] = useState(false);
  const { refreshTimestamp } = useAppSelector(state => state.projectReducer);


  const getLastUpdatedTasks = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await projectInsightsApiService.getLastUpdatedTasks(
        projectId,
        includeArchivedTasks
      );
      if (res.done) {
        setData(res.body);
      }
    } catch (error) {
      logger.error('getLastUpdatedTasks', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getLastUpdatedTasks();
  }, [projectId, includeArchivedTasks,refreshTimestamp]);

  // table columns
  const columns: TableProps['columns'] = [
    {
      key: 'name',
      title: t('members.name'),
      render: (record: IInsightTasks) => <Typography.Text>{record.name}</Typography.Text>,
    },
    {
      key: 'status',
      title: t('members.status'),
      render: (record: IInsightTasks) => (
        <Flex
          gap={4}
          style={{
            width: 'fit-content',
            borderRadius: 24,
            paddingInline: 6,
            backgroundColor: record.status_color,
            color: colors.darkGray,
            cursor: 'pointer',
          }}
        >
          <Typography.Text
            ellipsis={{ expanded: false }}
            style={{
              color: colors.darkGray,
              fontSize: 13,
            }}
          >
            {record.status}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      key: 'dueDate',
      title: t('members.dueDate'),
      render: (record: IInsightTasks) => (
        <Typography.Text>
          {record.end_date ? simpleDateFormat(record.end_date) : t('common.noData')}
        </Typography.Text>
      ),
    },
    {
      key: 'lastUpdated',
      title: t('members.lastUpdated'),
      render: (record: IInsightTasks) => (
        <Tooltip title={record.updated_at ? formatDateTimeWithLocale(record.updated_at) : t('common.noData')}>
          <Typography.Text>
            {record.updated_at ? calculateTimeDifference(record.updated_at) : t('common.noData')}
          </Typography.Text>
        </Tooltip>
      ),
    },
  ];

  const dataSource = data.map(record => ({
    ...record,
    key: record.id,
  }));

  return (
    <Table
      className="custom-two-colors-row-table"
      dataSource={dataSource}
      columns={columns}
      rowKey={record => record.id}
      pagination={{
        showSizeChanger: true,
        defaultPageSize: 20,
      }}
      loading={loading}
      onRow={() => {
        return {
          style: {
            cursor: 'pointer',
            height: 36,
          },
        };
      }}
    />
  );
};

export default LastUpdatedTasks;
