import { CaretDownFilled } from '@/shared/antd-imports';
import { useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Checkbox, Dropdown, List, Space } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { colors } from '@/styles/colors';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { setStatuses, fetchTaskGroups as fetchTaskGroupsList } from '@/features/tasks/tasks.slice';
import { setBoardStatuses, fetchBoardTaskGroups } from '@/features/board/board-slice';
import { ITaskStatus } from '@/types/tasks/taskStatus.types';

interface StatusFilterDropdownProps {
  statuses: ITaskStatus[];
}

const StatusFilterDropdown = ({ statuses }: StatusFilterDropdownProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('task-list-filters');
  const { projectView } = useTabSearchParam();

  const { statuses: selectedStatuses, loadingGroups } = useAppSelector(
    state => state.taskReducer
  );
  const { statuses: boardSelectedStatuses, loadingGroups: boardLoadingGroups } = useAppSelector(
    state => state.boardReducer
  );
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { projectId } = useAppSelector(state => state.projectReducer);

  // selectedStatuses in taskReducer is ITaskStatusViewModel[] — track by id
  const selectedIds: string[] =
    projectView === 'list'
      ? selectedStatuses.map((s: any) => s.id || '').filter(Boolean)
      : boardSelectedStatuses.map((s: any) => s.id || '').filter(Boolean);

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
  }, [dispatch, projectId, selectedStatuses, boardSelectedStatuses, projectView]);

  const handleSelectedStatus = useCallback(
    (statusId: string) => {
      if (!projectId) return;

      if (projectView === 'list') {
        const current = selectedStatuses.map((s: any) => s.id || '');
        const isSelected = current.includes(statusId);
        const updated = isSelected
          ? selectedStatuses.filter((s: any) => s.id !== statusId)
          : [...selectedStatuses, statuses.find(s => s.id === statusId)!];
        dispatch(setStatuses(updated as any));
        dispatch(fetchTaskGroupsList(projectId));
      } else {
        const current = boardSelectedStatuses.map((s: any) => s.id || '');
        const isSelected = current.includes(statusId);
        const updated = isSelected
          ? boardSelectedStatuses.filter((s: any) => s.id !== statusId)
          : [...boardSelectedStatuses, statuses.find(s => s.id === statusId)!];
        dispatch(setBoardStatuses(updated as any));
        dispatch(fetchBoardTaskGroups(projectId));
      }
    },
    [dispatch, projectId, projectView, selectedStatuses, boardSelectedStatuses, statuses]
  );

  const dropdownContent = useMemo(
    () => (
      <Card className="custom-card" style={{ width: 160 }} styles={{ body: { padding: 0 } }}>
        <List style={{ padding: 0, maxHeight: 250, overflow: 'auto' }}>
          {statuses?.map(status => (
            <List.Item
              className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
              key={status.id}
              onClick={() => handleSelectedStatus(status.id!)}
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
                  id={status.id}
                  checked={selectedIds.includes(status.id!)}
                  onChange={() => handleSelectedStatus(status.id!)}
                />
                <Badge color={status.color_code} />
                {status.name}
              </Space>
            </List.Item>
          ))}
        </List>
      </Card>
    ),
    [statuses, selectedIds, themeMode, handleSelectedStatus]
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => dropdownContent}
    >
      <Button icon={<CaretDownFilled />} iconPosition="end" style={buttonStyle}>
        <Space>
          {t('statusText', 'Status')}
          {selectedCount > 0 && <Badge size="small" count={selectedCount} color={colors.skyBlue} />}
        </Space>
      </Button>
    </Dropdown>
  );
};

export default StatusFilterDropdown;
