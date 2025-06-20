import React from 'react';
import { Card, Button, Space, Typography, Dropdown, Menu, Popconfirm, message } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  TagOutlined,
  UserOutlined,
  CheckOutlined,
  CloseOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { IGroupBy, bulkUpdateTasks, bulkDeleteTasks } from '@/features/tasks/tasks.slice';
import { AppDispatch, RootState } from '@/app/store';

const { Text } = Typography;

interface BulkActionBarProps {
  selectedTaskIds: string[];
  totalSelected: number;
  currentGrouping: IGroupBy;
  projectId: string;
  onClearSelection?: () => void;
}

const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedTaskIds,
  totalSelected,
  currentGrouping,
  projectId,
  onClearSelection,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { statuses, priorities } = useSelector((state: RootState) => state.taskReducer);

  const handleBulkStatusChange = (statusId: string) => {
    // dispatch(bulkUpdateTasks({ ids: selectedTaskIds, changes: { status: statusId } }));
    message.success(`Updated ${totalSelected} tasks`);
    onClearSelection?.();
  };

  const handleBulkPriorityChange = (priority: string) => {
    // dispatch(bulkUpdateTasks({ ids: selectedTaskIds, changes: { priority } }));
    message.success(`Updated ${totalSelected} tasks`);
    onClearSelection?.();
  };

  const handleBulkDelete = () => {
    // dispatch(bulkDeleteTasks(selectedTaskIds));
    message.success(`Deleted ${totalSelected} tasks`);
    onClearSelection?.();
  };

  const statusMenu = (
    <Menu
      onClick={({ key }) => handleBulkStatusChange(key)}
      items={statuses.map(status => ({
        key: status.id!,
        label: (
          <div className="flex items-center space-x-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: status.color_code }}
            />
            <span>{status.name}</span>
          </div>
        ),
      }))}
    />
  );

  const priorityMenu = (
    <Menu
      onClick={({ key }) => handleBulkPriorityChange(key)}
      items={[
        { key: 'critical', label: 'Critical', icon: <div className="w-2 h-2 rounded-full bg-red-500" /> },
        { key: 'high', label: 'High', icon: <div className="w-2 h-2 rounded-full bg-orange-500" /> },
        { key: 'medium', label: 'Medium', icon: <div className="w-2 h-2 rounded-full bg-yellow-500" /> },
        { key: 'low', label: 'Low', icon: <div className="w-2 h-2 rounded-full bg-green-500" /> },
      ]}
    />
  );

  const moreActionsMenu = (
    <Menu
      items={[
        {
          key: 'assign',
          label: 'Assign to member',
          icon: <UserOutlined />,
        },
        {
          key: 'labels',
          label: 'Add labels',
          icon: <TagOutlined />,
        },
        {
          key: 'archive',
          label: 'Archive tasks',
          icon: <EditOutlined />,
        },
      ]}
    />
  );

  return (
    <Card
      size="small"
      className="mb-4 bg-blue-50 border-blue-200"
      styles={{ body: { padding: '8px 16px' } }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Text strong className="text-blue-700">
            {totalSelected} task{totalSelected > 1 ? 's' : ''} selected
          </Text>
        </div>

        <Space>
          {/* Status Change */}
          {currentGrouping !== 'status' && (
            <Dropdown overlay={statusMenu} trigger={['click']}>
              <Button size="small" icon={<CheckOutlined />}>
                Change Status
              </Button>
            </Dropdown>
          )}

          {/* Priority Change */}
          {currentGrouping !== 'priority' && (
            <Dropdown overlay={priorityMenu} trigger={['click']}>
              <Button size="small" icon={<EditOutlined />}>
                Set Priority
              </Button>
            </Dropdown>
          )}

          {/* More Actions */}
          <Dropdown overlay={moreActionsMenu} trigger={['click']}>
            <Button size="small" icon={<MoreOutlined />}>
              More Actions
            </Button>
          </Dropdown>

          {/* Delete */}
          <Popconfirm
            title={`Delete ${totalSelected} task${totalSelected > 1 ? 's' : ''}?`}
            description="This action cannot be undone."
            onConfirm={handleBulkDelete}
            okText="Delete"
            cancelText="Cancel"
            okType="danger"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>

          {/* Clear Selection */}
          <Button
            size="small"
            icon={<CloseOutlined />}
            onClick={onClearSelection}
            title="Clear selection"
          >
            Clear
          </Button>
        </Space>
      </div>
    </Card>
  );
};

export default BulkActionBar; 