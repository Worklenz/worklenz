import { PlusOutlined } from '@/shared/antd-imports';
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
} from '@/shared/antd-imports';
import { useEffect, useMemo, useRef, useState } from 'react';
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

const LabelsSelector = ({ task }: LabelsSelectorProps) => {
  const { t } = useTranslation('task-list-table');
  const { socket } = useSocket();

  const labelInputRef = useRef<InputRef>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { labels } = useAppSelector(state => state.taskLabelsReducer);
  const [labelList, setLabelList] = useState<ITaskLabel[]>([]);

  const currentSession = useAuthService().getCurrentSession();
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const handleLabelChange = (label: ITaskLabel) => {
    const labelData = {
      task_id: task.id,
      label_id: label.id,
      parent_task: task.parent_task_id,
      team_id: currentSession?.team_id,
    };

    socket?.emit(SocketEvents.TASK_LABELS_CHANGE.toString(), JSON.stringify(labelData));
  };

  const handleCreateLabel = () => {
    if (!searchQuery.trim()) return;
    const labelData = {
      task_id: task.id,
      label: searchQuery.trim(),
      parent_task: task.parent_task_id,
      team_id: currentSession?.team_id,
    };
    socket?.emit(SocketEvents.CREATE_LABEL.toString(), JSON.stringify(labelData));
    setSearchQuery('');
  };

  useEffect(() => {
    setLabelList(labels as ITaskLabel[]);
  }, [labels, task.labels]);

  // used useMemo hook for re render the list when searching
  const filteredLabelData = useMemo(() => {
    return labelList.filter(label => label.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [labelList, searchQuery]);

  const labelDropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8, overflow: 'hidden' } }}>
      <Flex vertical gap={8}>
        <Input
          ref={labelInputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.currentTarget.value)}
          placeholder={t('labelInputPlaceholder')}
          onKeyDown={e => {
            const isLabel = filteredLabelData.findIndex(
              label => label.name?.toLowerCase() === searchQuery.toLowerCase()
            );
            if (isLabel === -1) {
              if (e.key === 'Enter') {
                handleCreateLabel();
              }
            }
          }}
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
              <List.Item
                className={themeMode === 'dark' ? 'custom-list-item dark' : 'custom-list-item'}
                key={label.id}
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
                  checked={
                    task?.all_labels
                      ? task?.all_labels.some(existingLabel => existingLabel.id === label.id)
                      : false
                  }
                  onChange={() => handleLabelChange(label)}
                >
                  <Flex gap={8}>
                    <Badge color={label.color_code} />
                    {label.name}
                  </Flex>
                </Checkbox>
              </List.Item>
            ))
          ) : (
            <Typography.Text
              style={{ color: colors.lightGray }}
              onClick={() => handleCreateLabel()}
            >
              {t('labelsSelectorInputTip')}
            </Typography.Text>
          )}
        </List>

        {/* <Divider style={{ margin: 0 }} /> */}

        {/* <Button
        type="primary"
        style={{ alignSelf: 'flex-end' }}
        onClick={() => handleCreateLabel()}
      >
        {t('okButton')}
      </Button> */}
      </Flex>
    </Card>
  );

  // function to focus label input
  const handleLabelDropdownOpen = (open: boolean) => {
    if (open) {
      setTimeout(() => {
        labelInputRef.current?.focus();
      }, 0);
    }
  };

  return (
    <Dropdown
      trigger={['click']}
      dropdownRender={() => labelDropdownContent}
      onOpenChange={handleLabelDropdownOpen}
    >
      <Button
        type="dashed"
        icon={<PlusOutlined style={{ fontSize: 11 }} />}
        style={{ height: 18 }}
        size="small"
      />
    </Dropdown>
  );
};

export default LabelsSelector;
