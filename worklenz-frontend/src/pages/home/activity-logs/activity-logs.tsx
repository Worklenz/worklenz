import { SyncOutlined } from '@/shared/antd-imports';
import { Badge, Button, Card, Empty, Flex, List, Tooltip, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useGetActivityLogsQuery } from '@/api/activity-logs/activity-logs.api.service';
import moment from 'moment';
import { renderActivityMessage, ActivityLogItem } from '@/utils/activity-log-i18n';

const ActivityLogs = () => {
  const { t } = useTranslation('home');

  const {
    data: activityLogsData,
    isFetching: activityLogsIsFetching,
    refetch,
  } = useGetActivityLogsQuery();

  const activityLogs = activityLogsData?.body || [];

  const cardTitle = (
    <Typography.Title level={5} style={{ marginBlockEnd: 0 }}>
      {t('activityLogs.title', { defaultValue: 'Recent Activity' })} ({activityLogs.length})
    </Typography.Title>
  );

  const cardExtra = (
    <Tooltip title={t('activityLogs.refresh', { defaultValue: 'Refresh activity logs' })}>
      <Button
        shape="circle"
        icon={<SyncOutlined spin={activityLogsIsFetching} />}
        onClick={refetch}
      />
    </Tooltip>
  );

  return (
    <Card title={cardTitle} extra={cardExtra} style={{ width: '100%' }}>
      <div style={{ maxHeight: 420, overflow: 'auto' }}>
        {activityLogs.length === 0 ? (
          <Empty
            image="https://s3.us-west-2.amazonaws.com/worklenz.com/assets/empty-box.webp"
            imageStyle={{ height: 60 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            description={
              <Typography.Text>
                {t('activityLogs.noActivities', { defaultValue: 'No recent activities' })}
              </Typography.Text>
            }
          />
        ) : (
          <List
            loading={activityLogsIsFetching}
            dataSource={activityLogs}
            renderItem={item => (
              <List.Item style={{ border: 'none', padding: '8px 0' }}>
                <Flex gap={8} align="flex-start" style={{ width: '100%' }}>
                  <div style={{ flexShrink: 0, marginTop: 2 }}>
                    {item.project_deleted ? (
                      <Badge color="#ff4d4f" style={{ backgroundColor: '#ff4d4f' }} />
                    ) : (
                      <Badge color="#52c41a" style={{ backgroundColor: '#52c41a' }} />
                    )}
                  </div>
                  <Flex vertical style={{ flex: 1, minWidth: 0 }}>
                    <Typography.Text
                      style={{
                        fontSize: 13,
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {renderActivityMessage(item, t)}
                    </Typography.Text>
                    <Flex gap={8} align="center" style={{ marginTop: 4 }}>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {item.project_deleted ? (
                          <span style={{ color: '#ff4d4f' }}>
                            {item.project_name}{' '}
                            {t('activityLogs.deletedProject', { defaultValue: '(Deleted)' })}
                          </span>
                        ) : (
                          item.project_name
                        )}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        •
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {moment(item.created_at).fromNow()}
                      </Typography.Text>
                    </Flex>
                  </Flex>
                </Flex>
              </List.Item>
            )}
          />
        )}
      </div>
    </Card>
  );
};

export default ActivityLogs;
