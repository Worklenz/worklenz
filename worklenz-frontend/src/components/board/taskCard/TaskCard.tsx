import React, { useEffect, useState } from 'react';
import {
  DatePicker,
  Tooltip,
  Tag,
  Avatar,
  Progress,
  Typography,
  Dropdown,
  MenuProps,
  Button,
} from '@/shared/antd-imports';
import {
  DoubleRightOutlined,
  PauseOutlined,
  UserAddOutlined,
  InboxOutlined,
  DeleteOutlined,
  MinusOutlined,
  ForkOutlined,
  CaretRightFilled,
  CaretDownFilled,
} from '@/shared/antd-imports';
import './TaskCard.css';
import dayjs, { Dayjs } from 'dayjs';
import AddMembersDropdown from '../../add-members-dropdown/add-members-dropdown';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { deleteTask } from '../../../features/tasks/tasks.slice';
import SubTaskCard from '../subTaskCard/SubTaskCard';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import Avatars from '@/components/avatars/avatars';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UniqueIdentifier } from '@dnd-kit/core';

interface taskProps {
  task: IProjectTask;
}

const TaskCard: React.FC<taskProps> = ({ task }) => {
  const [isSubTaskShow, setIsSubTaskShow] = useState(false);
  const [dueDate, setDueDate] = useState<Dayjs | null>(null);
  const [isToday, setIsToday] = useState(false);
  const [isTomorrow, setIsTomorrow] = useState(false);
  const [isItPrevDate, setIsItPrevDate] = useState(false);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const dispatch = useAppDispatch();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id as UniqueIdentifier,
    data: {
      type: 'task',
      task,
    },
  });

  const handleDateChange = (date: Dayjs | null) => {
    setDueDate(date);
  };
  const { t } = useTranslation('kanban-board');

  const formatDate = (date: Dayjs | null) => {
    if (!date) return '';

    const today = dayjs();
    const tomorrow = today.add(1, 'day');

    if (date.isSame(today, 'day')) {
      return t('today');
    } else if (date.isSame(tomorrow, 'day')) {
      return t('tomorrow');
    } else {
      return date.isSame(today, 'year') ? date.format('MMM DD') : date.format('MMM DD, YYYY');
    }
  };

  useEffect(() => {
    if (dueDate) {
      setIsToday(dueDate.isSame(dayjs(), 'day'));
      setIsTomorrow(dueDate.isSame(dayjs().add(1, 'day'), 'day'));
      setIsItPrevDate(dueDate.isBefore(dayjs()));
    } else {
      setIsToday(false);
      setIsTomorrow(false);
      setIsItPrevDate(false);
    }
  }, [dueDate]);

  const handleDelete = () => {
    if (!task.id) return;
    dispatch(deleteTask(task.id)); // Call delete function with taskId
  };

  const items: MenuProps['items'] = [
    {
      label: (
        <span>
          <UserAddOutlined /> <Typography.Text>{t('assignToMe')}</Typography.Text>
        </span>
      ),
      key: '1',
    },
    {
      label: (
        <span>
          <InboxOutlined /> <Typography.Text>{t('archive')}</Typography.Text>
        </span>
      ),
      key: '2',
    },
    {
      label: (
        <span onClick={handleDelete}>
          <DeleteOutlined /> <Typography.Text>{t('delete')}</Typography.Text>
        </span>
      ),
      key: '3',
    },
  ];

  // const progress = (task.subTasks?.length || 0 + 1 )/ (task.subTasks?.length || 0 + 1)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    touchAction: 'none',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Dropdown menu={{ items }} trigger={['contextMenu']}>
        <div
          className={`task-card ${themeMode === 'dark' ? 'dark-mode' : ''}`}
          style={{
            zIndex: 99,
            padding: '12px',
            backgroundColor: themeMode === 'dark' ? '#383838' : 'white',
            borderRadius: '4px',
            marginBottom: '12px',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {/* Labels and Progress */}
          <div style={{ display: 'flex' }}>
            <div>
              {task.labels?.length ? (
                <>
                  {task.labels.slice(0, 2).map((label, index) => (
                    <Tag key={index} style={{ marginRight: '4px' }} color={label.color_code}>
                      <span style={{ color: themeMode === 'dark' ? '#383838' : '' }}>
                        {label.name}
                      </span>
                    </Tag>
                  ))}
                  {task.labels?.length > 2 && <Tag>+ {task.labels.length - 2}</Tag>}
                </>
              ) : (
                ''
              )}
            </div>
            <div
              style={{
                maxWidth: '30px',
                height: '30px',
                marginLeft: 'auto',
              }}
            >
              <Tooltip title="1/1">
                <Progress type="circle" percent={task.progress} size={26} />
              </Tooltip>
            </div>
          </div>

          {/* Action Icons */}
          <div style={{ display: 'flex' }}>
            {task.priority === 'low' ? (
              <MinusOutlined
                style={{
                  color: '#52c41a',
                  marginRight: '0.25rem',
                }}
              />
            ) : task.priority === 'medium' ? (
              <PauseOutlined
                style={{
                  color: '#faad14',
                  transform: 'rotate(90deg)',
                  marginRight: '0.25rem',
                }}
              />
            ) : (
              <DoubleRightOutlined
                style={{
                  color: '#f5222d',
                  transform: 'rotate(-90deg)',
                  marginRight: '0.25rem',
                }}
              />
            )}
            <Typography.Text style={{ fontWeight: 500 }}>{task.name}</Typography.Text>
          </div>

          {/* Subtask Section */}

          <div>
            <div
              style={{
                marginTop: '0.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  opacity: 1,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  alignItems: 'center',
                  display: 'flex',
                  gap: '3px',
                }}
              >
                <Avatars members={task.names || []} />
                <Avatar
                  size="small"
                  className={
                    task.assignees?.length ? 'add-member-avatar' : 'hide-add-member-avatar'
                  }
                  style={{
                    backgroundColor: '#fff',
                    border: '1px dashed #c4c4c4',
                    color: '#000000d9',
                    fontSize: '12px',
                  }}
                >
                  <AddMembersDropdown />
                </Avatar>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'right',
                  alignItems: 'center',
                }}
              >
                <div>
                  <DatePicker
                    className={`custom-placeholder ${
                      !dueDate
                        ? 'empty-date'
                        : isToday
                          ? 'selected-date'
                          : isTomorrow
                            ? 'selected-date'
                            : isItPrevDate
                              ? 'red-colored'
                              : ''
                    }`}
                    placeholder={t('dueDate')}
                    style={{
                      fontSize: '12px',
                      opacity: dueDate ? 1 : 0,
                      width: dueDate ? 'auto' : '100%',
                      maxWidth: '100px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    onChange={handleDateChange}
                    variant="borderless"
                    size="small"
                    suffixIcon={false}
                    format={value => formatDate(value)}
                  />
                </div>
                {task.sub_tasks_count && task.sub_tasks_count > 1 && (
                  <Button
                    onClick={() => setIsSubTaskShow(!isSubTaskShow)}
                    size="small"
                    style={{ padding: 0 }}
                    type="text"
                  >
                    <Tag
                      bordered={false}
                      style={{ display: 'flex', alignItems: 'center', margin: 0 }}
                    >
                      <ForkOutlined rotate={90} />
                      <span>{task.sub_tasks_count}</span>
                      {isSubTaskShow ? <CaretDownFilled /> : <CaretRightFilled />}
                    </Tag>
                  </Button>
                )}
              </div>
            </div>

            {isSubTaskShow &&
              task.sub_tasks_count &&
              task.sub_tasks_count > 1 &&
              task.sub_tasks?.map(subtask => <SubTaskCard subtask={subtask} />)}
          </div>
        </div>
      </Dropdown>
    </div>
  );
};

export default TaskCard;
