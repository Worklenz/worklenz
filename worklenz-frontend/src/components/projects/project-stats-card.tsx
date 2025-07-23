import { ReactNode } from 'react';
import { Card, Flex, Skeleton, Tooltip, Typography } from '@/shared/antd-imports';
import { ExclamationCircleOutlined } from '@/shared/antd-imports';
import { colors } from '@/styles/colors';

type InsightCardProps = {
  icon: string;
  title: string;
  tooltip?: string;
  children: ReactNode;
  loading?: boolean;
};

const ProjectStatsCard = ({ icon, title, tooltip, children, loading }: InsightCardProps) => {
  return (
    <Card
      className="custom-insights-card"
      style={{ width: '100%' }}
      styles={{ body: { paddingInline: 16 } }}
    >
      <Skeleton loading={loading} active paragraph={{ rows: 2 }}>
        <Flex gap={16} align="center">
          <img
            src={icon}
            alt={`${title.toLowerCase()} icon`}
            style={{
              width: '100%',
              maxWidth: 42,
              height: '100%',
              maxHeight: 42,
            }}
          />
          <Flex vertical>
            <Typography.Text style={{ fontSize: 16 }}>
              {title}
              {tooltip && (
                <Tooltip title={tooltip}>
                  <ExclamationCircleOutlined
                    style={{
                      color: colors.skyBlue,
                      fontSize: 13,
                      marginInlineStart: 4,
                    }}
                  />
                </Tooltip>
              )}
            </Typography.Text>
            <Typography.Title level={2} style={{ marginBlock: 0 }}>
              {children}
            </Typography.Title>
          </Flex>
        </Flex>
      </Skeleton>
    </Card>
  );
};

export default ProjectStatsCard;
