import { Flex } from 'antd';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import ProjectViewFinanceHeader from './project-view-finance-header/project-view-finance-header';
import FinanceTab from './finance-tab/finance-tab';
import RatecardTab from './ratecard-tab/ratecard-tab';
import { fetchProjectFinances, setActiveTab, setActiveGroup } from '@/features/projects/finance/project-finance.slice';
import { RootState } from '@/app/store';

const ProjectViewFinance = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const dispatch = useAppDispatch();
  
  const { activeTab, activeGroup, loading, taskGroups } = useAppSelector((state: RootState) => state.projectFinances);
  const { refreshTimestamp } = useAppSelector((state: RootState) => state.projectReducer);

  useEffect(() => {
    if (projectId) {
      dispatch(fetchProjectFinances({ projectId, groupBy: activeGroup }));
    }
  }, [projectId, activeGroup, dispatch, refreshTimestamp]);

  return (
    <Flex vertical gap={16} style={{ overflowX: 'hidden' }}>
      <ProjectViewFinanceHeader
        activeTab={activeTab}
        setActiveTab={(tab) => dispatch(setActiveTab(tab))}
        activeGroup={activeGroup}
        setActiveGroup={(group) => dispatch(setActiveGroup(group))}
      />

      {activeTab === 'finance' ? (
        <FinanceTab 
          groupType={activeGroup} 
          taskGroups={taskGroups}
          loading={loading}
        />
      ) : (
        <RatecardTab />
      )}
    </Flex>
  );
};

export default ProjectViewFinance;
