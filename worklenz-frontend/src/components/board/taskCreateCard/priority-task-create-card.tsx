import { Avatar, Button, DatePicker, Input, InputRef } from '@/shared/antd-imports';
import React, { forwardRef, useEffect, useRef, useState } from 'react';
import AddMembersDropdown from '../../add-members-dropdown/add-members-dropdown';
import dayjs, { Dayjs } from 'dayjs';
import './TaskCreateCard.css';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { addTask, addTaskToTop } from '../../../features/tasks/tasks.slice';
import { setTaskCardDisabled } from '../../../features/board/create-card.slice';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
interface PriorityProps {
  status: string;
  position: 'top' | 'bottom';
}

const PriorityTaskCreateCard = forwardRef<InputRef, PriorityProps>(({ status, position }, ref) => {
  const [characterLength, setCharacterLength] = useState<number>(0);
  const [dueDate, setDueDate] = useState<Dayjs | null>(null);
  const [isToday, setIsToday] = useState(false);
  const [isTomorrow, setIsTomorrow] = useState(false);
  const [isItPrevDate, setIsItPrevDate] = useState(false);
  const [taskName, setTaskName] = useState('');
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { t } = useTranslation('kanban-board');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCharacterLength(e.target.value.length);
    setTaskName(e.target.value);
  };

  const handleDateChange = (date: Dayjs | null) => {
    setDueDate(date);
  };

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (ref && typeof ref === 'object' && ref.current) {
      ref.current.focus();
    }
  }, []);

  const formatDate = (date: Dayjs | null) => {
    if (!date) return '';

    const today = dayjs();
    const tomorrow = today.add(1, 'day');

    if (date.isSame(today, 'day')) {
      return 'Today';
    } else if (date.isSame(tomorrow, 'day')) {
      return 'Tomorrow';
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

  const handleAddTask = () => {
    if (taskName.trim()) {
      if (position === 'bottom') {
        dispatch(
          addTask({
            taskId: `SP-${Date.now()}`,
            task: taskName,
            description: '-',
            progress: status === 'done' ? 100 : 0,
            members: [],
            labels: [],
            status: status,
            priority: 'medium',
            timeTracking: 0,
            estimation: '-',
            startDate: new Date(),
            dueDate: dueDate ? dueDate.toDate() : null,
            completedDate: null,
            createdDate: new Date(),
            lastUpdated: new Date(),
            reporter: '-',
            phase: '',
            subTasks: [],
          })
        );
      } else if (position === 'top') {
        dispatch(
          addTaskToTop({
            taskId: `SP-${Date.now()}`,
            task: taskName,
            description: '-',
            progress: status === 'done' ? 100 : 0,
            members: [],
            labels: [],
            status: status,
            priority: 'medium',
            timeTracking: 0,
            estimation: '-',
            startDate: new Date(),
            dueDate: dueDate ? dueDate.toDate() : null,
            completedDate: null,
            createdDate: new Date(),
            lastUpdated: new Date(),
            reporter: '-',
            phase: '-',
            subTasks: [],
          })
        );
      }
    }
    setTaskName('');
  };

  const handleClose = () => {
    dispatch(setTaskCardDisabled({ status, position, disabled: true }));
  };

  return (
    <div
      ref={cardRef}
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
      }}
    >
      {/* Input field */}
      <div style={{ display: 'flex' }}>
        <Input
          ref={ref}
          type="text"
          maxLength={100}
          onChange={handleChange}
          value={taskName}
          onPressEnter={handleAddTask}
          placeholder="Enter task name"
        />
      </div>

      <div style={{ opacity: characterLength > 0 ? 1 : 0 }}>
        {/* Character Length */}
        <div
          style={{
            position: 'absolute',
            zIndex: 1,
            right: '15px',
            top: '43px',
            color: themeMode === 'dark' ? '#ffffffd9' : '#00000073',
            fontSize: '10px',
          }}
        >
          <span>{characterLength}/100</span>
        </div>

        {/* DatePicker and Avatars */}
        <div
          style={{
            paddingTop: '0.25rem',
            marginTop: '0.75rem',
            display: 'flex',
            marginBottom: '16px',
          }}
        >
          <div style={{ height: '100%', width: '100%' }}>
            <DatePicker
              className={`custom-placeholder ${!dueDate ? 'create-task-empty-date' : isToday ? 'selected-date' : isTomorrow ? 'selected-date' : isItPrevDate ? 'red-colored' : ''}`}
              placeholder={t('dueDate')}
              style={{
                fontSize: '12px',
                opacity: dueDate ? 1 : 0,
              }}
              onChange={handleDateChange}
              variant="borderless"
              size="small"
              suffixIcon={false}
              format={value => formatDate(value)}
            />
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <div
              style={{
                opacity: 1,
                borderRadius: '4px',
                cursor: 'pointer',
                alignItems: 'center',
                height: '100%',
                width: '100%',
                display: 'flex',
                gap: '3px',
              }}
            >
              <Avatar.Group>
                {/* <Avatar
                                        style={{
                                            backgroundColor:
                                                avatarNamesMap[
                                                    member?.charAt(0)
                                                ],
                                            verticalAlign: 'middle',
                                            fontSize: '12px',
                                        }}
                                        size="small"
                                    >
                                        {member.charAt(0)}
                                    </Avatar> */}
              </Avatar.Group>
              <Avatar
                size="small"
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
          </div>
        </div>
      </div>

      {/* Add Task Button and Cancel Button*/}
      <div>
        <Button size="small" style={{ marginRight: '8px', fontSize: '12px' }} onClick={handleClose}>
          {t('cancel')}
        </Button>
        <Button size="small" type="primary" style={{ fontSize: '12px' }} onClick={handleAddTask}>
          {t('addTask')}
        </Button>
      </div>
    </div>
  );
});

export default PriorityTaskCreateCard;
