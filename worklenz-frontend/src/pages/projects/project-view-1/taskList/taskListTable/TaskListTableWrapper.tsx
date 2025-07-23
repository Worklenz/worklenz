import { Badge, Button, Collapse, ConfigProvider, Dropdown, Flex, Input, Typography } from '@/shared/antd-imports';
import { useState } from 'react';
import { EditOutlined, EllipsisOutlined, RetweetOutlined, RightOutlined } from '@/shared/antd-imports';
import { colors } from '../../../../../styles/colors';
import './taskListTableWrapper.css';
import TaskListTable from './TaskListTable';
import { MenuProps } from 'antd/lib';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

type TaskListTableWrapperProps = {
  taskList: IProjectTask[];
  tableId: string;
  type: string;
  name: string;
  color: string;
  statusCategory?: string | null;
  priorityCategory?: string | null;
  onRename?: (name: string) => void;
  onStatusCategoryChange?: (category: string) => void;
};

const TaskListTableWrapper = ({
  taskList,
  tableId,
  name,
  type,
  color,
  statusCategory = null,
  priorityCategory = null,
  onRename,
  onStatusCategoryChange,
}: TaskListTableWrapperProps) => {
  const [tableName, setTableName] = useState<string>(name);
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [currentCategory, setCurrentCategory] = useState<string | null>(statusCategory);

  // localization
  const { t } = useTranslation('task-list-table');

  // function to handle toggle expand
  const handlToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // this is for get the color for every typed tables
  const getBgColorClassName = (type: string) => {
    switch (type) {
      case 'status':
        if (currentCategory === 'todo')
          return themeMode === 'dark' ? 'after:bg-[#3a3a3a]' : 'after:bg-[#d8d7d8]';
        else if (currentCategory === 'doing')
          return themeMode === 'dark' ? 'after:bg-[#3d506e]' : 'after:bg-[#c0d5f6]';
        else if (currentCategory === 'done')
          return themeMode === 'dark' ? 'after:bg-[#3b6149]' : 'after:bg-[#c2e4d0]';
        else return themeMode === 'dark' ? 'after:bg-[#3a3a3a]' : 'after:bg-[#d8d7d8]';

      case 'priority':
        if (priorityCategory === 'low')
          return themeMode === 'dark' ? 'after:bg-[#3b6149]' : 'after:bg-[#c2e4d0]';
        else if (priorityCategory === 'medium')
          return themeMode === 'dark' ? 'after:bg-[#916c33]' : 'after:bg-[#f9e3b1]';
        else if (priorityCategory === 'high')
          return themeMode === 'dark' ? 'after:bg-[#8b3a3b]' : 'after:bg-[#f6bfc0]';
        else return themeMode === 'dark' ? 'after:bg-[#916c33]' : 'after:bg-[#f9e3b1]';
      default:
        return '';
    }
  };

  // these codes only for status type tables
  // function to handle rename this functionality only available for status type tables
  const handleRename = () => {
    if (onRename) {
      onRename(tableName);
    }
    setIsRenaming(false);
  };

  // function to handle category change
  const handleCategoryChange = (category: string) => {
    setCurrentCategory(category);
    if (onStatusCategoryChange) {
      onStatusCategoryChange(category);
    }
  };

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

  // dropdown options
  const items: MenuProps['items'] = [
    {
      key: '1',
      icon: <EditOutlined />,
      label: 'Rename',
      onClick: () => setIsRenaming(true),
    },
    {
      key: '2',
      icon: <RetweetOutlined />,
      label: 'Change category',
      children: statusList?.map(status => ({
        key: status.id,
        label: (
          <Flex gap={8} onClick={() => handleCategoryChange(status.category)}>
            <Badge color={getStatusColor(status.category)} />
            {status.name}
          </Flex>
        ),
      })),
    },
  ];

  return (
    <ConfigProvider
      wave={{ disabled: true }}
      theme={{
        components: {
          Collapse: {
            headerPadding: 0,
            contentPadding: 0,
          },

          Select: {
            colorBorder: colors.transparent,
          },
        },
      }}
    >
      <Flex vertical>
        <Flex style={{ transform: 'translateY(6px)' }}>
          <Button
            className="custom-collapse-button"
            style={{
              backgroundColor: color,
              border: 'none',
              borderBottomLeftRadius: isExpanded ? 0 : 4,
              borderBottomRightRadius: isExpanded ? 0 : 4,
              color: themeMode === 'dark' ? '#ffffffd9' : colors.darkGray,
            }}
            icon={<RightOutlined rotate={isExpanded ? 90 : 0} />}
            onClick={handlToggleExpand}
          >
            {isRenaming ? (
              <Input
                size="small"
                value={tableName}
                onChange={e => setTableName(e.target.value)}
                onBlur={handleRename}
                onPressEnter={handleRename}
                autoFocus
              />
            ) : (
              <Typography.Text
                style={{
                  fontSize: 14,
                  color: themeMode === 'dark' ? '#ffffffd9' : colors.darkGray,
                }}
              >
                {/* check the default values available in the table names ==> this check for localization  */}
                {['todo', 'doing', 'done', 'low', 'medium', 'high'].includes(
                  tableName.replace(/\s+/g, '').toLowerCase()
                )
                  ? t(`${tableName.replace(/\s+/g, '').toLowerCase()}SelectorText`)
                  : tableName}{' '}
                ({taskList.length})
              </Typography.Text>
            )}
          </Button>
          {type === 'status' && !isRenaming && (
            <Dropdown menu={{ items }}>
              <Button icon={<EllipsisOutlined />} className="borderless-icon-btn" />
            </Dropdown>
          )}
        </Flex>
        <Collapse
          collapsible="header"
          className="border-l-4"
          bordered={false}
          ghost={true}
          expandIcon={() => null}
          activeKey={isExpanded ? '1' : undefined}
          onChange={handlToggleExpand}
          items={[
            {
              key: '1',
              className: `custom-collapse-content-box relative after:content after:absolute after:h-full after:w-1 ${getBgColorClassName(type)} after:z-10 after:top-0 after:left-0`,
              children: <TaskListTable taskList={taskList} tableId={tableId} />,
            },
          ]}
        />
      </Flex>
    </ConfigProvider>
  );
};

export default TaskListTableWrapper;
