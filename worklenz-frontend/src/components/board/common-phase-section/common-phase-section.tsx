import React, { useEffect, useRef, useState } from 'react';
import { Button, Dropdown, Input, InputRef, MenuProps, Typography } from '@/shared/antd-imports';
import {
  DeleteOutlined,
  EditOutlined,
  LoadingOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@/shared/antd-imports';
import { setTaskCardDisabled, initializeStatus } from '../../../features/board/create-card.slice';
import { TaskType } from '../../../types/task.types';
import TaskCreateCard from '../taskCreateCard/TaskCreateCard';
import TaskCard from '../taskCard/TaskCard';
import { useAppSelector } from '@/hooks/useAppSelector';

import '../commonStatusSection/CommonStatusSection';

import { deleteStatus } from '../../../features/projects/status/StatusSlice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import ChangeCategoryDropdown from '../changeCategoryDropdown/ChangeCategoryDropdown';
import { useTranslation } from 'react-i18next';

interface CommonPhaseSectionProps {
  status: string;
  dataSource: TaskType[];
  category: string;
  id: string;
}

const CommonPhaseSection: React.FC<CommonPhaseSectionProps> = ({
  status,
  dataSource,
  category,
  id,
}) => {
  const dispatch = useAppDispatch();
  const createTaskInputRef = useRef<InputRef>(null);

  // Initialize status in the Redux store if not already set
  useEffect(() => {
    dispatch(initializeStatus(status));
  }, [dispatch, status]);

  // Get status-specific disable controls from Redux state
  const isTopCardDisabled = useAppSelector(
    state => state.createCardReducer.taskCardDisabledStatus[status]?.top
  );
  const isBottomCardDisabled = useAppSelector(
    state => state.createCardReducer.taskCardDisabledStatus[status]?.bottom
  );
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const [addTaskCount, setAddTaskCount] = useState(0);
  const [name, setName] = useState(status);
  const [isEditable, setIsEditable] = useState(false);
  const inputRef = useRef<InputRef>(null);
  const [isLoading, setIsLoading] = useState(false);
  const taskCardRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation('kanban-board');

  const handleAddTaskClick = () => {
    dispatch(setTaskCardDisabled({ status, position: 'bottom', disabled: false }));
    setAddTaskCount(prev => prev + 1);
  };

  const handleTopAddTaskClick = () => {
    dispatch(setTaskCardDisabled({ status, position: 'top', disabled: false }));
    setAddTaskCount(prev => prev + 1);
  };

  useEffect(() => {
    if (isEditable && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditable]);

  useEffect(() => {
    createTaskInputRef.current?.focus();
    taskCardRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [dataSource, addTaskCount]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleBlur = () => {
    setIsEditable(false);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 3000);
  };

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
          onClick={() => setIsEditable(true)}
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

  return (
    <div style={{ paddingTop: '6px' }}>
      <div
        className={`todo-wraper ${themeMode === 'dark' ? 'dark-mode' : ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          flexBasis: 0,
          maxWidth: '375px',
          width: '375px',
          marginRight: '8px',
          padding: '8px',
          borderRadius: '25px',
          maxHeight: 'calc(100vh - 250px)',
          backgroundColor: themeMode === 'dark' ? '#282828' : '#F8FAFC',
        }}
      >
        <div
          style={{
            touchAction: 'none',
            userSelect: 'none',
            cursor: 'grab',
            fontSize: '14px',
            paddingTop: '0',
            margin: '0.25rem',
          }}
        >
          <div
            style={{
              fontWeight: 600,
              marginBottom: '12px',
              alignItems: 'center',
              padding: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              backgroundColor: category === 'unmapped' ? 'rgba(251, 200, 76, 0.41)' : '#d1d0d3',
              borderRadius: '10px',
            }}
          >
            <div
              style={{ display: 'flex', gap: '5px', alignItems: 'center' }}
              onClick={() => setIsEditable(true)}
            >
              {isLoading ? (
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
                  {dataSource.length}
                </Button>
              )}
              {isEditable ? (
                <Input
                  ref={inputRef}
                  value={name}
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
                  {name}
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
          style={{
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 250px)',
            padding: '2px 6px 2px 2px',
          }}
        >
          {!isTopCardDisabled && (
            <TaskCreateCard ref={createTaskInputRef} status={status} position={'top'} />
          )}

          {dataSource.map(task => (
            <TaskCard key={task.taskId} task={task} />
          ))}

          {!isBottomCardDisabled && (
            <TaskCreateCard ref={createTaskInputRef} status={status} position={'bottom'} />
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

export default CommonPhaseSection;
