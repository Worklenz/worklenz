import { Flex, Tooltip, Typography } from 'antd';
import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';

type TasksProgressCellProps = {
  tasksStat: { todo: number; doing: number; done: number } | null;
};

const TasksProgressCell = ({ tasksStat }: TasksProgressCellProps) => {
  // localization
  const { t } = useTranslation('reporting-members');

  if (!tasksStat) return null;
  const totalStat = tasksStat.todo + tasksStat.doing + tasksStat.done;
  if (totalStat === 0) return null;

  const todoPercent = Math.round((tasksStat.todo / totalStat) * 100);
  const doingPercent = Math.round((tasksStat.doing / totalStat) * 100);
  const donePercent = Math.round((tasksStat.done / totalStat) * 100);

  const segments = [
    { percent: donePercent, color: '#98d4b1', label: 'done' },
    { percent: doingPercent, color: '#bce3cc', label: 'doing' },
    { percent: todoPercent, color: '#e3f4ea', label: 'todo' },
  ];

  return (
    <Tooltip
      trigger={'hover'}
      title={
        <Flex vertical>
          {segments.map((seg, index) => (
            <Typography.Text
              key={index}
              style={{ color: colors.white }}
            >{`${t(`${seg.label}Text`)}: ${seg.percent}%`}</Typography.Text>
          ))}
        </Flex>
      }
    >
      <Flex
        align="center"
        style={{
          width: '100%',
          maxWidth: 200,
          height: 16,
          borderRadius: 4,
          overflow: 'hidden',
          cursor: 'pointer',
        }}
      >
        {segments.map(
          (segment, index) =>
            segment.percent > 0 && (
              <Typography.Text
                key={index}
                ellipsis
                style={{
                  textAlign: 'center',
                  fontSize: 10,
                  fontWeight: 500,
                  color: colors.darkGray,
                  padding: '2px 4px',
                  minWidth: 32,
                  flexBasis: `${segment.percent}%`,
                  backgroundColor: segment.color,
                }}
              >
                {segment.percent}%
              </Typography.Text>
            )
        )}
      </Flex>
    </Tooltip>
  );
};

export default TasksProgressCell;
