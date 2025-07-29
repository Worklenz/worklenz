import React, { useState } from 'react';
import { Button, Dropdown, Input, Menu, Badge, Tooltip } from '@/shared/antd-imports';
import {
  RightOutlined,
  LoadingOutlined,
  EllipsisOutlined,
  EditOutlined,
  RetweetOutlined,
} from '@/shared/antd-imports';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import { ITaskStatusCategory } from '@/types/status.types';
import { useAppSelector } from '@/hooks/useAppSelector';
// import WorklenzTaskListPhaseDuration from "./WorklenzTaskListPhaseDuration";
// import WorklenzTasksProgressBar from "./WorklenzTasksProgressBar";

interface Props {
  group: ITaskListGroup;
  projectId: string | null;
  categories: ITaskStatusCategory[];
}

const TaskListGroupSettings: React.FC<Props> = ({ group, projectId, categories }) => {
  const [edit, setEdit] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditColProgress, setIsEditColProgress] = useState(false);
  const [isGroupByPhases, setIsGroupByPhases] = useState(false);
  const [isGroupByStatus, setIsGroupByStatus] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const menu = (
    <Menu>
      <Menu.Item key="edit">
        <EditOutlined className="me-2" />
        Rename
      </Menu.Item>
      {isGroupByStatus && (
        <Menu.SubMenu
          key="change-category"
          title={
            <>
              <RetweetOutlined className="me-2" />
              Change category
            </>
          }
        >
          {categories.map(item => (
            <Tooltip key={item.id} title={item.description || ''} placement="right">
              <Menu.Item
                style={{
                  fontWeight: item.id === group.category_id ? 'bold' : undefined,
                }}
              >
                <Badge color={item.color_code} text={item.name || ''} />
              </Menu.Item>
            </Tooltip>
          ))}
        </Menu.SubMenu>
      )}
    </Menu>
  );

  const onBlurEditColumn = (group: ITaskListGroup) => {
    setEdit(false);
  };

  const onToggleClick = () => {
    console.log('onToggleClick');
  };

  const canDisplayActions = () => {
    return true;
  };

  return (
    <div className="d-flex justify-content-between align-items-center position-relative">
      <div className="d-flex align-items-center">
        <Button
          className={`collapse btn border-0 ${group.tasks.length ? 'active' : ''}`}
          onClick={onToggleClick}
          style={{ backgroundColor: group.color_code }}
        >
          <RightOutlined className="collapse-icon" />
          {`${group.name} (${group.tasks.length})`}
        </Button>

        {canDisplayActions() && (
          <Dropdown
            overlay={menu}
            trigger={['click']}
            onVisibleChange={visible => setShowMenu(visible)}
          >
            <Button className="p-0" type="text">
              <EllipsisOutlined />
            </Button>
          </Dropdown>
        )}
      </div>

      {/* {isGroupByPhases && group.name !== "Unmapped" && (
        <div className="d-flex align-items-center me-2 ms-auto">
          <WorklenzTaskListPhaseDuration group={group} />
        </div>
      )}

      {isProgressBarAvailable() && (
        <WorklenzTasksProgressBar
          todoProgress={group.todo_progress}
          doingProgress={group.doing_progress}
          doneProgress={group.done_progress}
        />
      )} */}
    </div>
  );
};

export default TaskListGroupSettings;
