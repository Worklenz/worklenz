import { Flex, Tooltip, Typography } from '@/shared/antd-imports';
import React from 'react';
import { colors } from '../../../../../../styles/colors';
import { useTranslation } from 'react-i18next';

type TasksProgressCellProps = {
  tasksStat: { todo: number; doing: number; done: number } | null;
};

const TasksProgressCell = ({ tasksStat }: TasksProgressCellProps) => {
  // localization
  const { t } = useTranslation('reporting-projects');

  if (!tasksStat) return null;

  const totalStat = tasksStat.todo + tasksStat.doing + tasksStat.done;
  if (totalStat === 0) return null;

  const todoPercent = Math.floor((tasksStat.todo / totalStat) * 100);
  const doingPercent = Math.floor((tasksStat.doing / totalStat) * 100);
  const donePercent = Math.floor((tasksStat.done / totalStat) * 100);

  const segments = [
    { percent: todoPercent, color: '#98d4b1', label: 'todo' },
    { percent: doingPercent, color: '#bce3cc', label: 'doing' },
    { percent: donePercent, color: '#e3f4ea', label: 'done' },
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
