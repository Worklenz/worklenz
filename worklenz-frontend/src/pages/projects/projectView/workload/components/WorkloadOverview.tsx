import {
  Row,
  Col,
  Card,
  Statistic,
  Progress,
  Flex,
  Skeleton,
  Typography,
  theme,
  Tooltip,
} from '@/shared/antd-imports';
import {
  TeamOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { IWorkloadData } from '@/types/workload/workload.types';
import { useAppSelector } from '@/hooks/useAppSelector';

interface WorkloadOverviewProps {
  data?: IWorkloadData;
  isLoading: boolean;
}

const WorkloadOverview = ({ data, isLoading }: WorkloadOverviewProps) => {
  const { t } = useTranslation('workload');
  const { token } = theme.useToken();
  const { alertThresholds } = useAppSelector(state => state.projectWorkload);

  if (isLoading) {
    return (
      <Row gutter={[16, 16]}>
        {[1, 2, 3, 4].map(key => (
          <Col xs={24} sm={12} lg={6} key={key}>
            <Card style={{ height: '100%' }}>
              <Skeleton active paragraph={{ rows: 2 }} />
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  if (!data) {
    return (
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card style={{ height: '100%' }}>
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Typography.Text type="secondary">{t('noWorkloadData')}</Typography.Text>
            </div>
          </Card>
        </Col>
      </Row>
    );
  }

  const { summary } = data;
  const utilizationColor =
    summary.averageUtilization > 100
      ? token.colorError
      : summary.averageUtilization > 80
        ? token.colorWarning
        : token.colorSuccess;

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} md={6}>
        <Card style={{ height: '100%' }}>
          <Tooltip
            title={`Team composition and allocation status.

Member Status:
• Total Members: ${summary.totalMembers}
• Overallocated: ${summary.overallocatedMembers} (>100% utilization)
• Underutilized: ${summary.underutilizedMembers} (<${alertThresholds.underutilization}% utilization)
• Optimal: ${summary.totalMembers - summary.overallocatedMembers - summary.underutilizedMembers}`}
            placement="top"
          >
            <Statistic
              title={
                <Flex align="center" gap={4}>
                  {t('overview.teamMembers')}
                  <InfoCircleOutlined style={{ fontSize: 12, opacity: 0.5 }} />
                </Flex>
              }
              value={summary.totalMembers}
              prefix={<TeamOutlined />}
            />
          </Tooltip>
        </Card>
      </Col>

      <Col xs={24} sm={12} md={6}>
        <Card style={{ height: '100%' }}>
          <Tooltip
            title={`Total estimated workload across all team members.

Includes:
• Estimated Hours: ${summary.totalEstimatedHours}h
• Actual Hours Logged: ${summary.totalActualHours}h
• Progress: ${Math.round((summary.totalActualHours / summary.totalEstimatedHours) * 100)}%`}
            placement="top"
          >
            <Statistic
              title={
                <Flex align="center" gap={4}>
                  {t('overview.totalWorkload')}
                  <InfoCircleOutlined style={{ fontSize: 12, opacity: 0.5 }} />
                </Flex>
              }
              value={summary.totalEstimatedHours}
              precision={1}
              suffix={t('overview.hours')}
              prefix={<ClockCircleOutlined />}
            />
          </Tooltip>
          <Progress
            percent={Math.round((summary.totalActualHours / summary.totalEstimatedHours) * 100)}
            size="small"
            status={summary.totalActualHours > summary.totalEstimatedHours ? 'exception' : 'active'}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} md={6}>
        <Card style={{ height: '100%' }}>
          <Tooltip
            title={t('calculations.averageUtilizationTooltip', {
              average: summary.averageUtilization.toFixed(1),
              memberCount: summary.totalMembers,
              totalAssigned: summary.totalEstimatedHours,
              totalCapacity:
                summary.totalMembers > 0
                  ? Math.round((summary.totalEstimatedHours * 100) / summary.averageUtilization)
                  : 0,
            })}
            placement="top"
          >
            <Statistic
              title={
                <Flex align="center" gap={4}>
                  {t('overview.averageUtilization')}
                  <InfoCircleOutlined style={{ fontSize: 12, opacity: 0.5 }} />
                </Flex>
              }
              value={summary.averageUtilization}
              precision={1}
              suffix="%"
              valueStyle={{ color: utilizationColor }}
              prefix={<CheckCircleOutlined />}
            />
          </Tooltip>
          <Progress
            percent={summary.averageUtilization}
            strokeColor={utilizationColor}
            size="small"
            showInfo={false}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} md={6}>
        <Card style={{ height: '100%' }}>
          <Tooltip
            title={t('overview.criticalTasksTooltip', {
              criticalTasks: summary.criticalTasks,
              totalTasks: summary.totalTasks,
              criticalPercentage: Math.round((summary.criticalTasks / summary.totalTasks) * 100)
            })}
            placement="top"
          >
            <Statistic
              title={
                <Flex align="center" gap={4}>
                  {t('overview.criticalTasks')}
                  <InfoCircleOutlined style={{ fontSize: 12, opacity: 0.5 }} />
                </Flex>
              }
              value={summary.criticalTasks}
              valueStyle={{
                color: summary.criticalTasks > 0 ? token.colorError : token.colorSuccess,
              }}
              prefix={<AlertOutlined />}
            />
          </Tooltip>
          <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 8 }}>
            {t('overview.totalTasks', { count: summary.totalTasks })}
          </div>
        </Card>
      </Col>
    </Row>
  );
};

export default WorkloadOverview;
