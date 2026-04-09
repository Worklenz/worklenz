import { memo } from 'react';
import Card from 'antd/es/card';
import Flex from 'antd/es/flex';
import Typography from 'antd/es/typography';
import Progress from 'antd/es/progress';
import Spin from 'antd/es/spin';

import { useGetCompletedTasksTodayPercentageQuery } from '@/api/personal-overview/personal-overview.api.service';
import { colors } from '@/styles/colors';

const TaskCompletionCard = memo(() => {
  console.log('TaskCompletionCard - Component Rendered');

  const { data, isLoading, isError, error } = useGetCompletedTasksTodayPercentageQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  console.log('TaskCompletionCard - Loading:', isLoading);
  console.log('TaskCompletionCard - Error:', isError, error);
  console.log('TaskCompletionCard - Data:', data);

  if (isLoading) {
    return (
      <Card style={{ width: '100%' }}>
        <Flex justify="center" align="center" style={{ minHeight: 80 }}>
          <Spin />
        </Flex>
      </Card>
    );
  }

  if (isError) {
    console.error('Error fetching completion percentage:', error);
    const errorMessage =
      error && 'status' in error
        ? `Error ${error.status}: ${JSON.stringify(error.data || 'Unknown error')}`
        : 'Failed to load task completion data';

    return (
      <Card style={{ width: '100%' }}>
        <Flex vertical gap={8} justify="center" align="center" style={{ minHeight: 80 }}>
          <Typography.Text type="danger">Failed to load task completion data</Typography.Text>
          <Typography.Text style={{ fontSize: 12, color: colors.lightGray }}>
            {errorMessage}
          </Typography.Text>
        </Flex>
      </Card>
    );
  }

  if (!data?.body) {
    console.warn('No data received from API');
    return null;
  }

  const { percentage, completed_tasks, total_tasks } = data.body;

  const getProgressColor = (percent: number) => {
    if (percent === 100) return colors.limeGreen;
    if (percent >= 75) return colors.skyBlue;
    if (percent >= 50) return colors.yellow;
    return colors.red;
  };

  const progressColor = getProgressColor(percentage);

  const getMessage = () => {
    if (total_tasks === 0) {
      return 'No tasks due today';
    }
    if (percentage === 100) {
      return 'All tasks completed!';
    }
    if (percentage >= 75) {
      return "Your today's tasks almost done!";
    }
    return 'Keep going with your tasks!';
  };

  return (
    <Card style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" gap={16}>
        <Typography.Text
          style={{
            fontSize: 14,
            color: colors.lightGray,
            flex: 1,
          }}
        >
          {getMessage()}
        </Typography.Text>

        <Progress
          type="circle"
          percent={percentage}
          strokeColor={progressColor}
          size={60}
          strokeWidth={8}
          format={percent => (
            <span style={{ fontSize: 16, fontWeight: 600, color: progressColor }}>{percent}%</span>
          )}
        />
      </Flex>
    </Card>
  );
});

TaskCompletionCard.displayName = 'TaskCompletionCard';

export default TaskCompletionCard;
