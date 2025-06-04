import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Flex,
  Input,
  InputRef,
  List,
  Typography,
} from 'antd';
import { useAppSelector } from '@/hooks/useAppSelector';
import { colors } from '@/styles/colors';
import { ITaskLabel } from '@/types/label.type';
import { useTranslation } from 'react-i18next';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { useAuthService } from '@/hooks/useAuth';
import { SocketEvents } from '@/shared/socket-events';
import { useSocket } from '@/socket/socketContext';

interface LabelsSelectorProps {
  task: IProjectTask;
}

// Memoized label item component
const LabelItem = React.memo(({ 
  label, 
  isChecked, 
  onLabelChange, 
  themeMode 
}: { 
  label: ITaskLabel; 
  isChecked: boolean; 
  onLabelChange: (label: ITaskLabel) => void;
  themeMode: string;
}) => (
  <List.Item
    className={themeMode === 'dark' ? 'custom-list-item dark' : 'custom-list-item'}
    style={{
      display: 'flex',
      justifyContent: 'flex-start',
      gap: 8,
      padding: '4px 8px',
      border: 'none',
    }}
  >
    <Checkbox
      id={label.id}
      checked={isChecked}
      onChange={() => onLabelChange(label)}
    >
      <Flex gap={8}>
        <Badge color={label.color_code} />
        {label.name}
      </Flex>
    </Checkbox>
  </List.Item>
));

// Memoized create label prompt
const CreateLabelPrompt = React.memo(({ 
  searchQuery, 
  onCreateLabel 
}: { 
  searchQuery: string; 
  onCreateLabel: () => void;
}) => (
  <Typography.Text
    style={{ color: colors.lightGray }}
    onClick={onCreateLabel}
  >
    Create "{searchQuery}"
  </Typography.Text>
));

const LabelsSelectorOptimized = React.memo<LabelsSelectorProps>(({ task }) => {
  const { t } = useTranslation('task-list-table');
  const { socket } = useSocket();
  const labelInputRef = useRef<InputRef>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { labels } = useAppSelector(state => state.taskLabelsReducer);
  const [labelList, setLabelList] = useState<ITaskLabel[]>([]);
  const currentSession = useAuthService().getCurrentSession();
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // Memoize handlers
  const handleLabelChange = useCallback((label: ITaskLabel) => {
    const labelData = {
      task_id: task.id,
      label_id: label.id,
      parent_task: task.parent_task_id,
      team_id: currentSession?.team_id,
    };

    socket?.emit(SocketEvents.TASK_LABELS_CHANGE.toString(), JSON.stringify(labelData));
  }, [task.id, task.parent_task_id, currentSession?.team_id, socket]);

  const handleCreateLabel = useCallback(() => {
    if (!searchQuery.trim()) return;
    const labelData = {
      task_id: task.id,
      label: searchQuery.trim(),
      parent_task: task.parent_task_id,
      team_id: currentSession?.team_id,
    };
    socket?.emit(SocketEvents.CREATE_LABEL.toString(), JSON.stringify(labelData));
    setSearchQuery('');
  }, [searchQuery, task.id, task.parent_task_id, currentSession?.team_id, socket]);

  const handleLabelDropdownOpen = useCallback((open: boolean) => {
    if (open) {
      setTimeout(() => {
        labelInputRef.current?.focus();
      }, 0);
    }
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.currentTarget.value);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const isLabel = filteredLabelData.findIndex(
      label => label.name?.toLowerCase() === searchQuery.toLowerCase()
    );
    if (isLabel === -1 && e.key === 'Enter') {
      handleCreateLabel();
    }
  }, [searchQuery, handleCreateLabel]);

  // Update label list when labels change
  useEffect(() => {
    setLabelList(labels as ITaskLabel[]);
  }, [labels, task.labels]);

  // Memoize filtered label data
  const filteredLabelData = useMemo(() => {
    return labelList.filter(label => 
      label.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [labelList, searchQuery]);

  // Memoize task labels set for faster lookup
  const taskLabelsSet = useMemo(() => {
    return new Set(task?.all_labels?.map(label => label.id) || []);
  }, [task?.all_labels]);

  // Memoize dropdown content
  const labelDropdownContent = useMemo(() => (
    <Card
      className="custom-card"
      styles={{ body: { padding: 8, overflow: 'hidden' } }}
    >
      <Flex vertical gap={8}>
        <Input
          ref={labelInputRef}
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder={t('labelInputPlaceholder')}
          onKeyDown={handleKeyDown}
        />

        <List
          style={{
            padding: 0,
            maxHeight: 150,
            overflow: 'scroll',
          }}
        >
          {filteredLabelData.length ? (
            filteredLabelData.map(label => (
              <LabelItem
                key={label.id}
                label={label}
                isChecked={taskLabelsSet.has(label.id)}
                onLabelChange={handleLabelChange}
                themeMode={themeMode}
              />
            ))
          ) : (
            <CreateLabelPrompt 
              searchQuery={searchQuery}
              onCreateLabel={handleCreateLabel}
            />
          )}
        </List>
      </Flex>
    </Card>
  ), [
    searchQuery,
    handleSearchChange,
    handleKeyDown,
    t,
    filteredLabelData,
    taskLabelsSet,
    handleLabelChange,
    themeMode,
    handleCreateLabel
  ]);

  // Memoize button style
  const buttonStyle = useMemo(() => ({ height: 18 }), []);

  // Memoize icon style
  const iconStyle = useMemo(() => ({ fontSize: 11 }), []);

  return (
    <Dropdown
      trigger={['click']}
      dropdownRender={() => labelDropdownContent}
      onOpenChange={handleLabelDropdownOpen}
      // Performance optimizations
      destroyPopupOnHide={false} // Keep dropdown content in DOM for better performance
    >
      <Button
        type="dashed"
        icon={<PlusOutlined style={iconStyle} />}
        style={buttonStyle}
        size="small"
      />
    </Dropdown>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better memoization
  return (
    prevProps.task.id === nextProps.task.id &&
    JSON.stringify(prevProps.task.all_labels) === JSON.stringify(nextProps.task.all_labels)
  );
});

LabelsSelectorOptimized.displayName = 'LabelsSelectorOptimized';

export default LabelsSelectorOptimized; 