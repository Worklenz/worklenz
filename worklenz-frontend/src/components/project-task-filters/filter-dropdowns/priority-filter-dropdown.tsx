import { CaretDownFilled } from '@ant-design/icons';
import { useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, Button, Card, Checkbox, Dropdown, List, Space } from 'antd';

import { useAppSelector } from '@/hooks/useAppSelector';
import { colors } from '@/styles/colors';
import { ITaskPriority } from '@/types/tasks/taskPriority.types';
import { setPriorities } from '@/features/tasks/tasks.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import useTabSearchParam from '@/hooks/useTabSearchParam';

import { fetchBoardTaskGroups, setBoardPriorities } from '@/features/board/board-slice';
import { fetchTaskGroups as fetchTaskGroupsList } from '@/features/tasks/tasks.slice';

interface PriorityFilterDropdownProps {
  priorities: ITaskPriority[];
}

const PriorityFilterDropdown = ({ priorities }: PriorityFilterDropdownProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('task-list-filters');

  const { priorities: selectedPriorities, loadingGroups } = useAppSelector(
    state => state.taskReducer
  );
  const { priorities: boardSelectedPriorities, loadingGroups: boardLoadingGroups } = useAppSelector(
    state => state.boardReducer
  );

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { projectId } = useAppSelector(state => state.projectReducer);

  const { projectView } = useTabSearchParam();

  const selectedCount =
    projectView === 'list' ? selectedPriorities.length : boardSelectedPriorities.length;

  const buttonStyle = {
    backgroundColor:
      selectedCount > 0 ? (themeMode === 'dark' ? '#003a5c' : colors.paleBlue) : colors.transparent,
    color: selectedCount > 0 ? (themeMode === 'dark' ? 'white' : colors.darkGray) : 'inherit',
  };

  useEffect(() => {
    if (projectId) {
      if (projectView === 'list' && !loadingGroups) {
        dispatch(fetchTaskGroupsList(projectId));
      } else if (projectView === 'kanban' && !boardLoadingGroups) {
        dispatch(fetchBoardTaskGroups(projectId));
      }
    }
  }, [dispatch, projectId, selectedPriorities, boardSelectedPriorities, projectView]);

  const handleSelectedPriority = useCallback(
    (priorityId: string) => {
      if (!projectId) return;

      const updatePriorities = (currentPriorities: string[], setAction: any, fetchAction: any) => {
        const newPriorities = currentPriorities.includes(priorityId)
          ? currentPriorities.filter(id => id !== priorityId)
          : [...currentPriorities, priorityId];
        dispatch(setAction(newPriorities));
        dispatch(fetchAction(projectId));
      };

      if (projectView === 'list') {
        updatePriorities(selectedPriorities, setPriorities, fetchTaskGroupsList);
      } else {
        updatePriorities(boardSelectedPriorities, setBoardPriorities, fetchBoardTaskGroups);
      }
    },
    [dispatch, projectId, projectView, selectedPriorities, boardSelectedPriorities]
  );

  const priorityDropdownContent = useMemo(
    () => (
      <Card className="custom-card" style={{ width: 120 }} styles={{ body: { padding: 0 } }}>
        <List style={{ padding: 0, maxHeight: 250, overflow: 'auto' }}>
          {priorities?.map(priority => (
            <List.Item
              className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
              key={priority.id}
              onClick={() => handleSelectedPriority(priority.id)}
              style={{
                display: 'flex',
                gap: 8,
                padding: '4px 8px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Space>
                <Checkbox
                  id={priority.id}
                  checked={
                    projectView === 'list'
                      ? selectedPriorities.includes(priority.id)
                      : boardSelectedPriorities.includes(priority.id)
                  }
                  onChange={() => handleSelectedPriority(priority.id)}
                />
                <Badge color={priority.color_code} />
                {priority.name}
              </Space>
            </List.Item>
          ))}
        </List>
      </Card>
    ),
    [priorities, selectedPriorities, boardSelectedPriorities, themeMode, handleSelectedPriority]
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => priorityDropdownContent}
    >
      <Button icon={<CaretDownFilled />} iconPosition="end" style={buttonStyle}>
        <Space>
          {t('priorityText')}
          {selectedCount > 0 && <Badge size="small" count={selectedCount} color={colors.skyBlue} />}
        </Space>
      </Button>
    </Dropdown>
  );
};

export default PriorityFilterDropdown;
