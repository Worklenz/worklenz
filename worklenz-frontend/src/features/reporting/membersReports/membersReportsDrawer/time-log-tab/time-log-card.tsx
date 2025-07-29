import { Card, ConfigProvider, Tag, Timeline, Typography } from '@/shared/antd-imports';
import { simpleDateFormat } from '@/utils/simpleDateFormat';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import {
  fetchTask,
  setSelectedTaskId,
  setShowTaskDrawer,
} from '@/features/task-drawer/task-drawer.slice';
import { ISingleMemberLogs } from '@/types/reporting/reporting.types';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';

type TimeLogCardProps = {
  data: ISingleMemberLogs;
};

const TimeLogCard = ({ data }: TimeLogCardProps) => {
  const { t } = useTranslation('reporting-members-drawer');

  const dispatch = useAppDispatch();

  const handleUpdateTaskDrawer = (id: string, projectId: string) => {
    if (!id || !projectId) return;

    dispatch(setSelectedTaskId(id));
    dispatch(fetchPhasesByProjectId(projectId));
    dispatch(fetchTask({ taskId: id, projectId: projectId }));
    dispatch(setShowTaskDrawer(true));
  };

  return (
    <ConfigProvider
      theme={{
        components: {
          Timeline: { dotBorderWidth: '2px' },
        },
      }}
    >
      <Card
        title={
          <Typography.Text style={{ fontSize: 16, fontWeight: 500 }}>
            {simpleDateFormat(data.log_day)}
          </Typography.Text>
        }
      >
        <Timeline>
          {data.logs.map((log, index) => (
            <Timeline.Item key={index} style={{ paddingBottom: 8 }}>
              <Typography.Text
                className="cursor-pointer hover:text-[#1899ff]"
                onClick={() => handleUpdateTaskDrawer(log.task_id, log.project_id)}
              >
                {t('loggedText')} <strong>{log.time_spent_string}</strong> {t('forText')}{' '}
                <strong>{log.task_name}</strong> {t('inText')} <strong>{log.project_name}</strong>{' '}
                <Tag>{log.task_key}</Tag>
              </Typography.Text>
            </Timeline.Item>
          ))}
        </Timeline>
      </Card>
    </ConfigProvider>
  );
};

export default TimeLogCard;
