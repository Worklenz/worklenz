import React, { useEffect, useRef } from 'react';
import { Form, Input, Button, Typography, List, InputRef } from 'antd';
import { PlusOutlined, DeleteOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { RootState } from '@/app/store';
import { setTasks } from '@/features/account-setup/account-setup.slice';
import { sanitizeInput } from '@/utils/sanitizeInput';

const { Title } = Typography;

interface Props {
  onEnter: () => void;
  styles: any;
  isDarkMode: boolean;
}

export const TasksStep: React.FC<Props> = ({ onEnter, styles, isDarkMode }) => {
  const { t } = useTranslation('account-setup');
  const dispatch = useDispatch();
  const { tasks, projectName } = useSelector((state: RootState) => state.accountSetupReducer);
  const inputRefs = useRef<(InputRef | null)[]>([]);

  const addTask = () => {
    if (tasks.length == 5) return;

    const newId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 0;
    dispatch(setTasks([...tasks, { id: newId, value: '' }]));
    setTimeout(() => {
      inputRefs.current[newId]?.focus();
    }, 0);
  };

  const removeTask = (id: number) => {
    if (tasks.length > 1) {
      dispatch(setTasks(tasks.filter(task => task.id !== id)));
    }
  };

  const updateTask = (id: number, value: string) => {
    const sanitizedValue = sanitizeInput(value);
    dispatch(
      setTasks(tasks.map(task => (task.id === id ? { ...task, value: sanitizedValue } : task)))
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget as HTMLInputElement;
    if (!input.value.trim()) return;
    e.preventDefault();
    addTask();
  };

  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 200);
  }, []);

  // Function to set ref that doesn't return anything (void)
  const setInputRef = (index: number) => (el: InputRef | null) => {
    inputRefs.current[index] = el;
  };

  return (
    <Form
      className="create-first-task-form"
      style={{
        minHeight: '300px',
        width: '600px',
        paddingBottom: '1rem',
        marginBottom: '3rem',
        marginTop: '3rem',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Form.Item>
        <Title level={2} style={{ marginBottom: '1rem' }}>
          {t('tasksStepTitle')}
        </Title>
      </Form.Item>
      <Form.Item
        layout="vertical"
        rules={[{ required: true }]}
        label={
          <span className="font-medium">
            {t('tasksStepLabel')} "<mark>{projectName}</mark>". {t('maxTasks')}
          </span>
        }
      >
        <List
          dataSource={tasks}
          bordered={false}
          renderItem={(task, index) => (
            <List.Item key={task.id}>
              <div style={{ display: 'flex', width: '600px' }}>
                <Input
                  placeholder="Your Task"
                  value={task.value}
                  onChange={e => updateTask(task.id, e.target.value)}
                  onPressEnter={handleKeyPress}
                  ref={setInputRef(index)}
                />
                <Button
                  className="custom-close-button"
                  style={{ marginLeft: '48px' }}
                  type="text"
                  icon={<CloseCircleOutlined />}
                  disabled={tasks.length === 1}
                  onClick={() => removeTask(task.id)}
                />
              </div>
            </List.Item>
          )}
        />
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={addTask}
          disabled={tasks.length == 5}
          style={{ marginTop: '16px' }}
        >
          {t('tasksStepAddAnother')}
        </Button>
        <div
          style={{
            marginTop: '24px',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        ></div>
      </Form.Item>
    </Form>
  );
};
