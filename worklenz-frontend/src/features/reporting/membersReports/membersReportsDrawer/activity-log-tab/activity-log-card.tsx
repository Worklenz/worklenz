import { Card, ConfigProvider, Tag, Timeline, Typography } from '@/shared/antd-imports';
import { simpleDateFormat } from '@/utils/simpleDateFormat';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { colors } from '../../../../../styles/colors';
import { useTranslation } from 'react-i18next';
import {
  fetchTask,
  setSelectedTaskId,
  setShowTaskDrawer,
} from '@/features/task-drawer/task-drawer.slice';
import {
  ISingleMemberActivityLog,
  ISingleMemberActivityLogs,
} from '@/types/reporting/reporting.types';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';

type TaskStatus = {
  name: string;
  color_code: string;
};

type ActivityLogCardProps = {
  data: ISingleMemberActivityLogs;
};

const ActivityLogCard = ({ data }: ActivityLogCardProps) => {
  // localization
  const { t } = useTranslation('reporting-members-drawer');

  const dispatch = useAppDispatch();

  const handleUpdateTaskDrawer = (id: string, projectId: string) => {
    if (!id || !projectId) return;

    dispatch(setSelectedTaskId(id));
    dispatch(fetchPhasesByProjectId(projectId));
    dispatch(fetchTask({ taskId: id, projectId: projectId }));
    dispatch(setShowTaskDrawer(true));
  };

  // this function format the attribute type
  const formatAttributeType = (attribute: string) =>
    attribute.replace('_', ' ').replace(/\b\w/g, char => char.toUpperCase());

  // this function render the colord tag
  const renderStyledTag = (value: TaskStatus | null) => {
    if (!value) return <Tag>None</Tag>;
    return (
      <Tag style={{ color: colors.darkGray, borderRadius: 48 }} color={value.color_code}>
        {value.name}
      </Tag>
    );
  };

  // this function render the default normal tag
  const renderDefaultTag = (value: string | null) => <Tag>{value || 'None'}</Tag>;

  // this function render the tag conditionally if type status, priority or phases then return colord tag else return default tag
  const renderTag = (log: ISingleMemberActivityLog, type: 'previous' | 'current') => {
    if (!log.attribute_type) return null;
    const isStatus = log.attribute_type === 'status';
    const isPriority = log.attribute_type === 'priority';
    const isPhase = log.attribute_type === 'phase';

    if (isStatus) {
      return renderStyledTag(type === 'previous' ? log.previous_status : log.next_status);
    } else if (isPriority) {
      return renderStyledTag(type === 'previous' ? log.previous_priority : log.next_priority);
    } else if (isPhase) {
      return renderStyledTag(type === 'previous' ? log.previous_phase : log.next_phase);
    } else {
      return renderDefaultTag(type === 'previous' ? log.previous : log.current);
    }
  };

  return (
    <ConfigProvider
      theme={{
        components: {
          Timeline: { itemPaddingBottom: 24, dotBorderWidth: '2px' },
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
            <Timeline.Item key={index}>
              <Typography.Text
                className="cursor-pointer hover:text-[#1899ff]"
                onClick={() => handleUpdateTaskDrawer(log.task_id, log.project_id)}
              >
                {t('updatedText')} <strong>{formatAttributeType(log.attribute_type)}</strong>{' '}
                {t('fromText')} {renderTag(log, 'previous')} {t('toText')}{' '}
                {renderTag(log, 'current')} {t('inText')} <strong>{log.task_name}</strong>{' '}
                {t('withinText')} <strong>{log.project_name}</strong> <Tag>{log.task_key}</Tag>
              </Typography.Text>
            </Timeline.Item>
          ))}
        </Timeline>
      </Card>
    </ConfigProvider>
  );
};

export default ActivityLogCard;
