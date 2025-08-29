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

  const items = useMemo(() => {
    const baseItems = [
      { key: IGroupBy.STATUS, label: t('statusText') },
      { key: IGroupBy.PRIORITY, label: t('priorityText') },
      { key: IGroupBy.PHASE, label: project?.phase_label || t('phaseText') },
    ];

    // if (projectView === 'kanban') {
    //   return [...baseItems, { key: IGroupBy.MEMBERS, label: t('memberText') }];
    // }

    return baseItems;
  }, [t, project?.phase_label, projectView]);

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
    <Flex align="center" gap={4} style={{ marginInlineStart: 12 }}>
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
