import {
  DeleteOutlined,
  DoubleRightOutlined,
  InboxOutlined,
  RetweetOutlined,
  UserAddOutlined,
} from '@/shared/antd-imports';
import { Badge, Dropdown, Flex, Typography } from '@/shared/antd-imports';
import { MenuProps } from 'antd/lib';
import React from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';

type TaskContextMenuProps = {
  visible: boolean;
  position: { x: number; y: number };
  selectedTask: string;
  onClose: () => void;
};

const TaskContextMenu = ({ visible, position, selectedTask, onClose }: TaskContextMenuProps) => {
  // find the available status for the currently active project
  const statusList = useAppSelector(state => state.statusReducer.status);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo':
        return '#d8d7d8';
      case 'doing':
        return '#c0d5f6';
      case 'done':
        return '#c2e4d0';
      default:
        return '#d8d7d8';
    }
  };

  const items: MenuProps['items'] = [
    {
      key: '1',
      icon: <UserAddOutlined />,
      label: ' Assign to me',
    },
    {
      key: '2',
      icon: <RetweetOutlined />,
      label: 'Move to',
      children: statusList?.map(status => ({
        key: status.id,
        label: (
          <Flex gap={8}>
            <Badge color={getStatusColor(status.category)} />
            {status.name}
          </Flex>
        ),
      })),
    },
    {
      key: '3',
      icon: <InboxOutlined />,
      label: 'Archive',
    },
    {
      key: '4',
      icon: <DoubleRightOutlined />,
      label: 'Convert to Sub task',
    },
    {
      key: '5',
      icon: <DeleteOutlined />,
      label: ' Delete',
    },
  ];

  return visible ? (
    <Dropdown menu={{ items }} trigger={['contextMenu']} open={visible} onOpenChange={onClose}>
      <div
        style={{
          position: 'fixed',
          top: position.y,
          left: position.x,
          zIndex: 1000,
          width: 1,
          height: 1,
        }}
      ></div>
    </Dropdown>
  ) : null;
};

export default TaskContextMenu;
