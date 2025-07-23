import { Alert, DatePicker, Flex, Form, Input, InputRef, Select, Typography } from '@/shared/antd-imports';
import { useEffect, useRef, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { TFunction } from 'i18next';
import {
  useGetMyTasksQuery,
  useGetProjectsByTeamQuery,
} from '@/api/home-page/home-page.api.service';
import { IProject } from '@/types/project/project.types';
import { IHomeTaskCreateRequest } from '@/types/tasks/task-create-request.types';
import { useAuthService } from '@/hooks/useAuth';
import { SocketEvents } from '@/shared/socket-events';
import { IMyTask } from '@/types/home/my-tasks.types';
import { useSocket } from '@/socket/socketContext';
import { ITaskAssigneesUpdateResponse } from '@/types/tasks/task-assignee-update-response';
import dayjs from 'dayjs';

interface AddTaskInlineFormProps {
  t: TFunction;
  calendarView: boolean;
}

const AddTaskInlineForm = ({ t, calendarView }: AddTaskInlineFormProps) => {
  const [isAlertShowing, setIsAlertShowing] = useState(false);
  const [isDueDateFieldShowing, setIsDueDateFieldShowing] = useState(false);
  const [isProjectFieldShowing, setIsProjectFieldShowing] = useState(false);
  const [form] = Form.useForm();
  const currentSession = useAuthService().getCurrentSession();
  const { socket } = useSocket();

  const { data: projectListData, isFetching: projectListFetching } = useGetProjectsByTeamQuery();
  const { homeTasksConfig } = useAppSelector(state => state.homePageReducer);
  const { refetch } = useGetMyTasksQuery(homeTasksConfig);

  const taskInputRef = useRef<InputRef | null>(null);

  const dueDateOptions = [
    {
      value: 'Today',
      label: t('home:tasks.today'),
    },
    {
      value: 'Tomorrow',
      label: t('home:tasks.tomorrow'),
    },
    {
      value: 'Next Week',
      label: t('home:tasks.nextWeek'),
    },
    {
      value: 'Next Month',
      label: t('home:tasks.nextMonth'),
    },
    {
      value: 'No Due Date',
      label: t('home:tasks.noDueDate'),
    },
  ];

  const calculateEndDate = (dueDate: string): string | undefined => {
    const today = new Date();
    let targetDate: Date;

    switch (dueDate) {
      case 'Today':
        targetDate = new Date(today);
        break;
      case 'Tomorrow':
        targetDate = new Date(today);
        targetDate.setDate(today.getDate() + 1);
        break;
      case 'Next Week':
        targetDate = new Date(today);
        targetDate.setDate(today.getDate() + 7);
        break;
      case 'Next Month':
        targetDate = new Date(today);
        targetDate.setMonth(today.getMonth() + 1);
        break;
      default:
        return undefined;
    }

    return targetDate.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
  };

  const projectOptions = [
    ...(projectListData?.body?.map((project: IProject) => ({
      key: project.id,
      value: project.id,
      label: project.name,
    })) || []),
  ];

  const handleTaskSubmit = (values: { name: string; project: string; dueDate: string }) => {
    const endDate = calendarView
      ? homeTasksConfig.selected_date?.format('YYYY-MM-DD')
      : calculateEndDate(values.dueDate);

    const newTask = {
      name: values.name,
      project_id: values.project,
      reporter_id: currentSession?.id,
      team_id: currentSession?.team_id,
      end_date: endDate || new Date().toISOString().split('T')[0], // Fallback to today if undefined
    };

    socket?.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(newTask));
    socket?.on(SocketEvents.QUICK_TASK.toString(), (task: IMyTask) => {
      if (task) {
        const taskBody = {
          team_member_id: currentSession?.team_member_id,
          project_id: task.project_id,
          task_id: task.id,
          reporter_id: currentSession?.id,
          mode: 0,
        };
        socket?.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), JSON.stringify(taskBody));
        socket?.once(
          SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(),
          (response: ITaskAssigneesUpdateResponse) => {
            refetch();
          }
        );
      }
    });

    setTimeout(() => {
      if (taskInputRef.current) {
        taskInputRef.current.focus({
          cursor: 'start',
        });
      }
      form.resetFields();
      setIsDueDateFieldShowing(false);
      setIsProjectFieldShowing(false);
    }, 100);
  };

  useEffect(() => {
    form.setFieldValue('dueDate', homeTasksConfig.selected_date || dayjs());
  }, [homeTasksConfig.selected_date]);

  useEffect(() => {
    if (calendarView) {
      form.setFieldValue('dueDate', homeTasksConfig.selected_date || dayjs());
    } else {
      form.setFieldValue('dueDate', dueDateOptions[0]?.value);
    }
    return () => {
      socket?.off(SocketEvents.QUICK_TASK.toString());
      socket?.off(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString());
    };
  }, []);

  return (
    <Form
      form={form}
      onFinish={handleTaskSubmit}
      style={{ display: 'flex', gap: 8 }}
      initialValues={{
        dueDate: calendarView ? homeTasksConfig.selected_date || dayjs() : dueDateOptions[0]?.value,
        project: projectOptions[0]?.value,
      }}
    >
      <Form.Item
        name="name"
        style={{ width: '100%', maxWidth: 400 }}
        rules={[
          {
            required: true,
            message: t('home:tasks.taskRequired'),
          },
        ]}
      >
        <Flex vertical gap={4}>
          <Input
            ref={taskInputRef}
            placeholder={t('home:tasks.addTask')}
            style={{ width: '100%' }}
            onChange={e => {
              const inputValue = e.currentTarget.value;
              if (inputValue.length >= 1) setIsAlertShowing(true);
              else if (inputValue === '') setIsAlertShowing(false);
            }}
            onKeyDown={e => {
              const inputValue = e.currentTarget.value;
              if (inputValue.trim() === '') return;
              if (e.key === 'Tab' || e.key === 'Enter') {
                setIsAlertShowing(false);
                if (!calendarView) {
                  setIsDueDateFieldShowing(true);
                } else {
                  setIsProjectFieldShowing(true);
                }
              }
            }}
          />
          {isAlertShowing && (
            <Alert
              message={
                <Typography.Text style={{ fontSize: 11 }}>
                  {t('home:tasks.pressTabToSelectDueDateAndProject')}
                </Typography.Text>
              }
              type="info"
              style={{
                width: 'fit-content',
                borderRadius: 2,
                padding: '0 6px',
              }}
            />
          )}
        </Flex>
      </Form.Item>

      <Form.Item name="dueDate" style={{ width: '100%', maxWidth: 200 }}>
        {isDueDateFieldShowing && !calendarView && (
          <Select
            suffixIcon={null}
            options={dueDateOptions}
            defaultOpen
            onSelect={() => {
              setIsProjectFieldShowing(true);
            }}
            onChange={() => {
              setIsProjectFieldShowing(true);
            }}
          />
        )}
        {calendarView && (
          <DatePicker
            disabled
            value={homeTasksConfig.selected_date || dayjs()}
            onChange={() => {
              setIsProjectFieldShowing(true);
            }}
          />
        )}
      </Form.Item>

      <Form.Item
        name="project"
        style={{ width: '100%', maxWidth: 200 }}
        rules={[
          {
            required: true,
            message: t('home:tasks.projectRequired'),
          },
        ]}
      >
        {isProjectFieldShowing && (
          <Select
            suffixIcon={null}
            placeholder={'Project'}
            options={projectOptions}
            defaultOpen
            showSearch
            autoFocus={!calendarView}
            optionFilterProp="label"
            filterSort={(optionA, optionB) =>
              (optionA?.label ?? '')
                .toLowerCase()
                .localeCompare((optionB?.label ?? '').toLowerCase())
            }
            onSelect={() => {
              form.submit();
            }}
            onInputKeyDown={e => {
              if (e.key === 'Tab' || e.key === 'Enter') {
                form.submit();
              }
            }}
          />
        )}
      </Form.Item>
    </Form>
  );
};

export default AddTaskInlineForm;
