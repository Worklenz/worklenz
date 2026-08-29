import { CaretDownFilled } from '@/shared/antd-imports';
import { useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Checkbox, Dropdown, List, Space } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { colors } from '@/styles/colors';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { setPhases, fetchTaskGroups as fetchTaskGroupsList } from '@/features/tasks/tasks.slice';
import { setBoardPhases, fetchBoardTaskGroups } from '@/features/board/board-slice';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';

interface PhaseFilterDropdownProps {
  phases: ITaskPhase[];
}

const PhaseFilterDropdown = ({ phases }: PhaseFilterDropdownProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('task-list-filters');
  const { projectView } = useTabSearchParam();

  const { phases: selectedPhases, loadingGroups } = useAppSelector(state => state.taskReducer);
  const { phases: boardSelectedPhases, loadingGroups: boardLoadingGroups } = useAppSelector(
    state => state.boardReducer
  );
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { projectId } = useAppSelector(state => state.projectReducer);

  const selectedIds = projectView === 'list' ? selectedPhases : boardSelectedPhases;
  const selectedCount = selectedIds.length;

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
  }, [dispatch, projectId, selectedPhases, boardSelectedPhases, projectView]);

  const handleSelectedPhase = useCallback(
    (phaseId: string) => {
      if (!projectId) return;

      const updatePhases = (current: string[], setAction: any, fetchAction: any) => {
        const updated = current.includes(phaseId)
          ? current.filter(id => id !== phaseId)
          : [...current, phaseId];
        dispatch(setAction(updated));
        dispatch(fetchAction(projectId));
      };

      if (projectView === 'list') {
        updatePhases(selectedPhases, setPhases, fetchTaskGroupsList);
      } else {
        updatePhases(boardSelectedPhases, setBoardPhases, fetchBoardTaskGroups);
      }
    },
    [dispatch, projectId, projectView, selectedPhases, boardSelectedPhases]
  );

  const dropdownContent = useMemo(
    () => (
      <Card className="custom-card" style={{ width: 160 }} styles={{ body: { padding: 0 } }}>
        <List style={{ padding: 0, maxHeight: 250, overflow: 'auto' }}>
          {phases?.map(phase => (
            <List.Item
              className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
              key={phase.id}
              onClick={() => handleSelectedPhase(phase.id)}
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
                  id={phase.id}
                  checked={selectedIds.includes(phase.id)}
                  onChange={() => handleSelectedPhase(phase.id)}
                />
                <Badge color={phase.color_code} />
                {phase.name}
              </Space>
            </List.Item>
          ))}
        </List>
      </Card>
    ),
    [phases, selectedIds, themeMode, handleSelectedPhase]
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => dropdownContent}
    >
      <Button icon={<CaretDownFilled />} iconPosition="end" style={buttonStyle}>
        <Space>
          {t('phaseText', 'Phase')}
          {selectedCount > 0 && <Badge size="small" count={selectedCount} color={colors.skyBlue} />}
        </Space>
      </Button>
    </Dropdown>
  );
};

export default PhaseFilterDropdown;
