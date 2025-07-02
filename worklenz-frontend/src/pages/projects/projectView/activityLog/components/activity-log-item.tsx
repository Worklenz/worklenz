import React from 'react';
import { Avatar, Flex, Tag, Tooltip, Timeline, Skeleton, Typography } from 'antd';
const { Text } = Typography;
import { ArrowRightOutlined, UserOutlined } from '@ant-design/icons';
import { IProjectActivityLog } from '@/api/projects/project-activity-logs-api.service';

interface ActivityLogItemProps {
  activity?: IProjectActivityLog;
  isLoading?: boolean;
  style?: React.CSSProperties;
}

const ActivityLogItem: React.FC<ActivityLogItemProps> = ({ activity, isLoading, style }) => {
  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const truncateText = (text?: string, maxLength: number = 50): string => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const renderAttributeValue = (activity: IProjectActivityLog) => {
    switch (activity.attribute_type) {
      case 'name':
        return (
          <Flex gap={4} align="center" style={{ fontSize: '12px' }}>
            <Text code>{truncateText(activity.previous)}</Text>
            <ArrowRightOutlined style={{ color: '#999' }} />
            <Text code>{truncateText(activity.current)}</Text>
          </Flex>
        );

      case 'status':
        return (
          <Flex gap={4} align="center">
            <Tag color={activity.previous_status?.color_code || 'default'} style={{ margin: 0, fontSize: '11px' }}>
              {activity.previous_status?.name || 'None'}
            </Tag>
            <ArrowRightOutlined style={{ color: '#999', fontSize: '10px' }} />
            <Tag color={activity.next_status?.color_code || 'default'} style={{ margin: 0, fontSize: '11px' }}>
              {activity.next_status?.name || 'None'}
            </Tag>
          </Flex>
        );

      case 'priority':
        return (
          <Flex gap={4} align="center">
            <Tag color={activity.previous_priority?.color_code || 'default'} style={{ margin: 0, fontSize: '11px' }}>
              {activity.previous_priority?.name || 'None'}
            </Tag>
            <ArrowRightOutlined style={{ color: '#999', fontSize: '10px' }} />
            <Tag color={activity.next_priority?.color_code || 'default'} style={{ margin: 0, fontSize: '11px' }}>
              {activity.next_priority?.name || 'None'}
            </Tag>
          </Flex>
        );

      case 'assignee':
        if (activity.log_type === 'assign' && activity.assigned_user) {
          return (
            <Tag color={activity.assigned_user.color_code || '#1890ff'} style={{ margin: 0, fontSize: '11px' }}>
              Assigned to {activity.assigned_user.name}
            </Tag>
          );
        } else if (activity.log_type === 'unassign') {
          return (
            <Tag color="red" style={{ margin: 0, fontSize: '11px' }}>
              Unassigned
            </Tag>
          );
        }
        break;

      case 'estimation':
        return (
          <Flex gap={4} align="center" style={{ fontSize: '12px' }}>
            <Text code>{activity.previous || '0m'}</Text>
            <ArrowRightOutlined style={{ color: '#999' }} />
            <Text code>{activity.current || '0m'}</Text>
          </Flex>
        );

      case 'start date':
      case 'end date':
        return (
          <Flex gap={4} align="center" style={{ fontSize: '12px' }}>
            <Text code>{activity.previous || 'None'}</Text>
            <ArrowRightOutlined style={{ color: '#999' }} />
            <Text code>{activity.current || 'None'}</Text>
          </Flex>
        );

      case 'description':
        return (
          <Text italic style={{ fontSize: '12px', color: '#666' }}>
            Description updated
          </Text>
        );

      default:
        if (activity.previous && activity.current) {
          return (
            <Flex gap={4} align="center" style={{ fontSize: '12px' }}>
              <Text code>{truncateText(activity.previous, 20)}</Text>
              <ArrowRightOutlined style={{ color: '#999' }} />
              <Text code>{truncateText(activity.current, 20)}</Text>
            </Flex>
          );
        }
        return null;
    }
  };

  if (isLoading || !activity) {
    return (
      <div style={{ ...style, padding: '24px 16px',marginBottom: '20px', borderBottom: '1px solid #f0f0f0' }}>
        <Timeline.Item>
          <div style={{ minHeight: '80px' }}>
            <Flex gap={12} align="flex-start">
              <Skeleton.Avatar active size="default" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Skeleton active paragraph={{ rows: 2 }} title={{ width: '60%' }} />
              </div>
            </Flex>
          </div>
        </Timeline.Item>
      </div>
    );
  }

  return (
    <div style={{ ...style, padding: '24px 16px',marginBottom: '20px', borderBottom: '1px solid #f0f0f0',borderRadius: '4px',boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)' }}>
      <Timeline.Item>
        <div style={{ minHeight: '80px' }}>
          <Flex gap={12} align="flex-start">
            <Avatar
              src={activity.done_by?.avatar_url}
              style={{ 
                backgroundColor: activity.done_by?.color_code || '#1890ff',
                color: 'white',
                flexShrink: 0
              }}
              icon={!activity.done_by?.avatar_url && <UserOutlined />}
            >
              {!activity.done_by?.avatar_url && activity.done_by?.name?.charAt(0).toUpperCase()}
            </Avatar>

            <div style={{ flex: 1, minWidth: 0 }}>
              <Flex gap={8} align="center" wrap style={{ marginBottom: '8px' }}>
                <Text strong style={{ 
                  color: activity.done_by?.color_code || '#1890ff',
                  fontSize: '14px'
                }}>
                  {activity.done_by?.name}
                </Text>
                <Text style={{ fontSize: '14px' }}>{activity.log_text}</Text>
              </Flex>

              <Flex gap={8} align="center" wrap style={{ marginBottom: '10px' }}>
                <Tag color="blue" style={{ 
                  fontSize: '11px', 
                  margin: 0,
                  padding: '2px 6px'
                }}>
                  {activity.task_key}
                </Tag>
                <Text strong style={{ 
                  fontSize: '13px',
                  maxWidth: '300px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {activity.task_name}
                </Text>
              </Flex>

              {renderAttributeValue(activity)}

              <div style={{ marginTop: '10px' }}>
                <Tooltip title={formatDateTime(activity.created_at)}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {formatTimeAgo(activity.created_at)}
                  </Text>
                </Tooltip>
              </div>
            </div>
          </Flex>
        </div>
      </Timeline.Item>
    </div>
  );
};

export default ActivityLogItem;