import React, { useCallback, useEffect, useState } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchTaskGroups, fetchTaskListColumns, toggleColumnVisibility } from '@/features/tasks/tasks.slice';
import TaskListTable from './TaskListTable';
import { Button, Dropdown, Menu, Checkbox } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { ITaskListColumn, ITaskListGroup } from '@/types/tasks/taskList.types';
import { RootState } from '@/store';

const TaskListWrapper: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { taskGroups, columns, loadingGroups } = useAppSelector((state: RootState) => state.taskReducer);
  const projectId = useAppSelector((state: RootState) => state.projectReducer.projectId);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (projectId) {
      dispatch(fetchTaskGroups(projectId));
      dispatch(fetchTaskListColumns(projectId));
    }
  }, [dispatch, projectId]);

  const handleColumnVisibilityChange = useCallback((columnId: string, isVisible: boolean) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnId]: isVisible,
    }));
    dispatch(toggleColumnVisibility(columnId));
  }, [dispatch]);

  const columnMenu = (
    <Menu>
      {columns.map((column: ITaskListColumn) => (
        <Menu.Item key={column.key}>
          <Checkbox
            checked={columnVisibility[column.key] ?? column.pinned}
            onChange={(e) => handleColumnVisibilityChange(column.key, e.target.checked)}
          >
            {column.name}
          </Checkbox>
        </Menu.Item>
      ))}
    </Menu>
  );

  if (loadingGroups) {
    return <div>Loading...</div>;
  }

  return (
    <div className="task-list-wrapper">
      <div className="task-list-header">
        <Dropdown overlay={columnMenu} trigger={['click']}>
          <Button icon={<SettingOutlined />}>
            {t('Columns')}
          </Button>
        </Dropdown>
      </div>
      
      <div className="task-list-content">
        {taskGroups.map((group: ITaskListGroup) => (
          <div key={group.id} className="task-group">
            <div 
              className="task-group-header"
              style={{ backgroundColor: group.color_code }}
            >
              <h3>{group.name}</h3>
              <span>{group.tasks.length} tasks</span>
            </div>
            
            <TaskListTable
              tasks={group.tasks}
              groupId={group.id}
              color={group.color_code}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskListWrapper; 