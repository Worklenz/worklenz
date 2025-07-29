import React, { useEffect, useRef, useState } from 'react';
import { Button, Dropdown, Input, InputRef, MenuProps, Typography } from '@/shared/antd-imports';
import {
  DeleteOutlined,
  EditOutlined,
  LoadingOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { setTaskCardDisabled, initializeGroup } from '@/features/board/create-card.slice';
import TaskCreateCard from '../taskCreateCard/TaskCreateCard';
import TaskCard from '../taskCard/TaskCard';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { deleteStatus } from '@features/projects/status/StatusSlice';
import ChangeCategoryDropdown from '../changeCategoryDropdown/ChangeCategoryDropdown';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

import './kanban-group.css';

interface KanbanGroupProps {
  title: string;
  tasks: IProjectTask[];
  id: string;
  color: string;
}

interface GroupState {
  name: string;
  isEditable: boolean;
  isLoading: boolean;
  addTaskCount: number;
}

const KanbanGroup: React.FC<KanbanGroupProps> = ({ title, tasks, id, color }) => {
  // Refs
  const inputRef = useRef<InputRef>(null);
  const createTaskInputRef = useRef<InputRef>(null);
  const taskCardRef = useRef<HTMLDivElement>(null);

  // State
  const [groupState, setGroupState] = useState<GroupState>({
    name: title,
    isEditable: false,
    isLoading: false,
    addTaskCount: 0,
  });

  // Hooks
  const dispatch = useAppDispatch();
  const { t } = useTranslation('kanban-board');

  // Selectors
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isTopCardDisabled = useAppSelector(
    state => state.createCardReducer.taskCardDisabledStatus[id]?.top
  );
  const isBottomCardDisabled = useAppSelector(
    state => state.createCardReducer.taskCardDisabledStatus[id]?.bottom
  );

  // Add droppable functionality
  const { setNodeRef } = useDroppable({
    id: id,
  });

  // Effects
  useEffect(() => {
    dispatch(initializeGroup(id));
  }, [dispatch, id]);

  useEffect(() => {
    if (groupState.isEditable && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [groupState.isEditable]);

  useEffect(() => {
    createTaskInputRef.current?.focus();
    taskCardRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [tasks, groupState.addTaskCount]);

  // Handlers
  const handleAddTaskClick = () => {
    dispatch(setTaskCardDisabled({ group: id, position: 'bottom', disabled: false }));
    setGroupState(prev => ({ ...prev, addTaskCount: prev.addTaskCount + 1 }));
  };

  const handleTopAddTaskClick = () => {
    dispatch(setTaskCardDisabled({ group: id, position: 'top', disabled: false }));
    setGroupState(prev => ({ ...prev, addTaskCount: prev.addTaskCount + 1 }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGroupState(prev => ({ ...prev, name: e.target.value }));
  };

  const handleBlur = () => {
    setGroupState(prev => ({ ...prev, isEditable: false, isLoading: true }));
    setTimeout(() => {
      setGroupState(prev => ({ ...prev, isLoading: false }));
    }, 3000);
  };

  const handleEditClick = () => {
    setGroupState(prev => ({ ...prev, isEditable: true }));
  };

  // Menu items
  const items: MenuProps['items'] = [
    {
      key: '1',
      label: (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            width: '100%',
            padding: '5px 12px',
            gap: '8px',
          }}
          onClick={handleEditClick}
        >
          <EditOutlined /> <span>{t('rename')}</span>
        </div>
      ),
    },
    {
      key: '2',
      label: <ChangeCategoryDropdown id={id} />,
    },
    {
      key: '3',
      label: (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            width: '100%',
            padding: '5px 12px',
            gap: '8px',
          }}
          onClick={() => dispatch(deleteStatus(id))}
        >
          <DeleteOutlined /> <span>{t('delete')}</span>
        </div>
      ),
    },
  ];

  // Styles
  const containerStyle = {
    paddingTop: '6px',
  };

  const wrapperStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    flexGrow: 1,
    flexBasis: 0,
    maxWidth: '375px',
    width: '375px',
    marginRight: '8px',
    padding: '8px',
    borderRadius: '25px',
    maxHeight: 'calc(100vh - 250px)',
    backgroundColor: themeMode === 'dark' ? '#282828' : '#F8FAFC',
  };

  const headerStyle = {
    touchAction: 'none' as const,
    userSelect: 'none' as const,
    cursor: 'grab',
    fontSize: '14px',
    paddingTop: '0',
    margin: '0.25rem',
  };

  const titleBarStyle = {
    fontWeight: 600,
    marginBottom: '12px',
    alignItems: 'center',
    padding: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    backgroundColor: color,
    borderRadius: '10px',
  };

  return (
    <div style={containerStyle}>
      <div
        className={`todo-wraper ${themeMode === 'dark' ? 'dark-mode' : ''}`}
        style={wrapperStyle}
      >
        <div style={headerStyle}>
          <div style={titleBarStyle}>
            <div
              style={{ display: 'flex', gap: '5px', alignItems: 'center' }}
              onClick={handleEditClick}
            >
              {groupState.isLoading ? (
                <LoadingOutlined />
              ) : (
                <Button
                  type="text"
                  size="small"
                  shape="circle"
                  style={{
                    backgroundColor: themeMode === 'dark' ? '#383838' : 'white',
                  }}
                >
                  {tasks.length}
                </Button>
              )}
              {groupState.isEditable ? (
                <Input
                  ref={inputRef}
                  value={groupState.name}
                  variant="borderless"
                  style={{
                    backgroundColor: themeMode === 'dark' ? 'black' : 'white',
                  }}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  onPressEnter={handleBlur}
                />
              ) : (
                <Typography.Text
                  style={{
                    textTransform: 'capitalize',
                    color: themeMode === 'dark' ? '#383838' : '',
                  }}
                >
                  {groupState.name}
                </Typography.Text>
              )}
            </div>
            <div style={{ display: 'flex' }}>
              <Button
                type="text"
                size="small"
                shape="circle"
                onClick={handleTopAddTaskClick}
                style={{ color: themeMode === 'dark' ? '#383838' : '' }}
              >
                <PlusOutlined />
              </Button>
              <Dropdown
                overlayClassName="todo-threedot-dropdown"
                trigger={['click']}
                menu={{ items }}
                placement="bottomLeft"
              >
                <Button type="text" size="small" shape="circle">
                  <MoreOutlined
                    style={{
                      rotate: '90deg',
                      fontSize: '25px',
                      color: themeMode === 'dark' ? '#383838' : '',
                    }}
                  />
                </Button>
              </Dropdown>
            </div>
          </div>
        </div>

        <div
          ref={setNodeRef}
          style={{
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 250px)',
            padding: '2px 6px 2px 2px',
          }}
        >
          {!isTopCardDisabled && (
            <TaskCreateCard ref={createTaskInputRef} status={title} position={'top'} />
          )}

          <SortableContext
            items={tasks.map(task => task.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="App" style={{ display: 'flex', flexDirection: 'column' }}>
              {tasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </SortableContext>

          {!isBottomCardDisabled && (
            <TaskCreateCard ref={createTaskInputRef} status={title} position={'bottom'} />
          )}
        </div>

        <div
          style={{
            textAlign: 'center',
            margin: '7px 8px 8px 8px',
            backgroundColor: themeMode === 'dark' ? '#383838' : 'white',
            padding: '0',
          }}
        >
          <Button
            type="text"
            style={{
              height: '38px',
              width: '100%',
            }}
            icon={<PlusOutlined />}
            onClick={handleAddTaskClick}
          >
            {t('addTask')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default KanbanGroup;
