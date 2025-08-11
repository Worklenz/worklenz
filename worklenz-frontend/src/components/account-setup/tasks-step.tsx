import React, { useEffect, useRef, useState } from 'react';
import { Input, Button, Typography, Card } from '@/shared/antd-imports';
import { PlusOutlined, DeleteOutlined, CloseCircleOutlined, CheckCircleOutlined } from '@/shared/antd-imports';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { RootState } from '@/app/store';
import { setTasks } from '@/features/account-setup/account-setup.slice';
import { sanitizeInput } from '@/utils/sanitizeInput';

const { Title, Paragraph, Text } = Typography;

interface Props {
  onEnter: () => void;
  styles: any;
  isDarkMode: boolean;
  token?: any;
}


export const TasksStep: React.FC<Props> = ({ onEnter, styles, isDarkMode, token }) => {
  const { t } = useTranslation('account-setup');
  const dispatch = useDispatch();
  const { tasks, projectName, surveyData } = useSelector((state: RootState) => state.accountSetupReducer);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const addTask = () => {
    if (tasks.length >= 5) return;
    const newId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 0;
    dispatch(setTasks([...tasks, { id: newId, value: '' }]));
    setTimeout(() => inputRefs.current[tasks.length]?.focus(), 100);
  };

  const removeTask = (id: number) => {
    if (tasks.length > 1) dispatch(setTasks(tasks.filter(task => task.id !== id)));
  };

  const updateTask = (id: number, value: string) => {
    const sanitizedValue = sanitizeInput(value);
    dispatch(setTasks(tasks.map(task => (task.id === id ? { ...task, value: sanitizedValue } : task))));
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      const input = e.currentTarget as HTMLInputElement;
      if (input.value.trim()) {
        e.preventDefault();
        if (index === tasks.length - 1 && tasks.length < 5) addTask();
        else if (index < tasks.length - 1) inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    const emptyTaskIndex = tasks.findIndex(task => !task.value.trim());
    if (emptyTaskIndex !== -1) {
      updateTask(tasks[emptyTaskIndex].id, suggestion);
    } else if (tasks.length < 5) {
      const newId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 0;
      dispatch(setTasks([...tasks, { id: newId, value: suggestion }]));
    }
    setShowSuggestions(false);
  };

  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 200);
  }, []);


  return (
    <div className="w-full tasks-step">
      {/* Header */}
      <div className="text-center mb-8">
        <Title level={3} className="mb-2" style={{ color: token?.colorText }}>
          {t('tasksStepTitle')}
        </Title>
        <Paragraph className="text-base" style={{ color: token?.colorTextSecondary }}>
          {t('tasksStepDescription', { projectName })}
        </Paragraph>
      </div>


      {/* Tasks List */}
      <div className="mb-6">
        <div className="space-y-4">
          {tasks.map((task, index) => (
            <Card 
              key={task.id}
              className={`task-item-card transition-all duration-200 ${
                focusedIndex === index ? 'border-2' : ''
              }`}
              style={{ 
                borderColor: focusedIndex === index ? token?.colorPrimary : token?.colorBorder,
                backgroundColor: token?.colorBgContainer 
              }}
            >
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium" style={{ backgroundColor: task.value.trim() ? token?.colorSuccess : token?.colorBorderSecondary, color: task.value.trim() ? '#fff' : token?.colorTextSecondary }}>
                  {task.value.trim() ? <CheckCircleOutlined /> : index + 1}
                </div>
                
                <div className="flex-1">
                  <Input
                    placeholder={t('taskPlaceholder', { index: index + 1 })}
                    value={task.value}
                    onChange={e => updateTask(task.id, e.target.value)}
                    onKeyPress={e => handleKeyPress(e, index)}
                    onFocus={() => setFocusedIndex(index)}
                    onBlur={() => setFocusedIndex(null)}
                    ref={(el) => { inputRefs.current[index] = el as any; }}
                    className="text-base border-0 shadow-none task-input"
                    style={{ backgroundColor: 'transparent', color: token?.colorText }}
                  />
                </div>

                {tasks.length > 1 && <Button type="text" icon={<CloseCircleOutlined />} onClick={() => removeTask(task.id)} className="text-gray-400 hover:text-red-500" style={{ color: token?.colorTextTertiary }} />}
              </div>
            </Card>
          ))}
        </div>

        {tasks.length < 5 && (
          <Button type="dashed" icon={<PlusOutlined />} onClick={addTask} className="w-full mt-4 h-12 text-base" style={{ borderColor: token?.colorBorder, color: token?.colorTextSecondary }}>{t('addAnotherTask', { current: tasks.length, max: 5 })}</Button>
        )}
      </div>

    </div>
  );
};