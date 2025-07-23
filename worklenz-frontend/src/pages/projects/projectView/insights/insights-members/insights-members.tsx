import { Card, Flex, Typography } from '@/shared/antd-imports';
import TaskByMembersTable from './tables/tasks-by-members';

import MemberStats from '../member-stats/member-stats';
import { TFunction } from 'i18next';

const InsightsMembers = ({ t }: { t: TFunction }) => {
  return (
    <Flex vertical gap={24}>
      <MemberStats />

      <Card
        className="custom-insights-card"
        title={
          <Typography.Text style={{ fontSize: 16, fontWeight: 500 }}>
            {t('members.tasksByMembers')}
          </Typography.Text>
        }
        style={{ width: '100%' }}
      >
        <TaskByMembersTable />
      </Card>
    </Flex>
  );
};

export default InsightsMembers;
