import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretDownFilled, Dropdown, Button, Flex, ConfigProvider } from '@/shared/antd-imports';
import { useSearchParams } from 'react-router-dom';

import ConfigPhaseButton from '@features/projects/singleProject/phase/ConfigPhaseButton';
import { useAppSelector } from '@/hooks/useAppSelector';
import CreateStatusButton from '@/components/project-task-filters/create-status-button/create-status-button';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { IGroupBy, setCurrentGroup, setGroup } from '@features/tasks/tasks.slice';
import { setBoardGroupBy, setCurrentBoardGroup } from '@/features/board/board-slice';
import { useAuthService } from '@/hooks/useAuth';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import { getSoftwareProjectLabels, isSoftwareProjectType } from '@/lib/project/software-project';

const GroupByFilterDropdown = () => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const isProjectManager = useIsProjectManager();

  const { groupBy } = useAppSelector(state => state.taskReducer);
  const { groupBy: boardGroupBy } = useAppSelector(state => state.boardReducer);
  const { project } = useAppSelector(state => state.projectReducer);
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();

  const tab = searchParams.get('tab');
  const projectView = tab === 'tasks-list' ? 'list' : 'kanban';

  const currentGroup = projectView === 'list' ? groupBy : boardGroupBy;
  const softwareLabels = getSoftwareProjectLabels(project?.project_type);

  const items = useMemo(() => {
    const phaseLabel = isSoftwareProjectType(project?.project_type)
      ? softwareLabels.phase
      : project?.phase_label || t('phaseText', { defaultValue: 'Phase' });

    return [
      { key: IGroupBy.STATUS, label: t('statusText', { defaultValue: 'Status' }) },
      { key: IGroupBy.PRIORITY, label: t('priorityText', { defaultValue: 'Priority' }) },
      { key: IGroupBy.PHASE, label: phaseLabel },
    ];
  }, [t, project?.phase_label, project?.project_type, softwareLabels.phase]);

  const handleGroupChange = (key: string) => {
    const group = key as IGroupBy;

    if (projectView === 'list') {
      setCurrentGroup(group);
      dispatch(setGroup(group));
    } else {
      setCurrentBoardGroup(group);
      dispatch(setBoardGroupBy(group));
    }
  };

  const selectedLabel = items.find(item => item.key === currentGroup)?.label;

  return (
    <Flex align="center" gap={4}>
      {t('groupByText')}:
      <Dropdown
        trigger={['click']}
        menu={{
          items,
          onClick: info => handleGroupChange(info.key),
          selectedKeys: [currentGroup],
        }}
      >
        <Button>
          {selectedLabel} <CaretDownFilled />
        </Button>
      </Dropdown>
      {(currentGroup === IGroupBy.STATUS || currentGroup === IGroupBy.PHASE) &&
        (isOwnerOrAdmin || isProjectManager) && (
          <ConfigProvider wave={{ disabled: true }}>
            {currentGroup === IGroupBy.PHASE && <ConfigPhaseButton />}
            {currentGroup === IGroupBy.STATUS && <CreateStatusButton />}
          </ConfigProvider>
        )}
    </Flex>
  );
};

export default GroupByFilterDropdown;
