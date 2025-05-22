import { Flex } from 'antd';
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ProjectViewFinanceHeader from './project-view-finance-header/project-view-finance-header';
import FinanceTab from './finance-tab/finance-tab';
import RatecardTab from './ratecard-tab/ratecard-tab';
import { projectFinanceApiService } from '@/api/project-finance-ratecard/project-finance.api.service';
import { IProjectFinanceGroup } from '@/types/project/project-finance.types';

type FinanceTabType = 'finance' | 'ratecard';
type GroupTypes = 'status' | 'priority' | 'phases';

interface TaskGroup {
  group_id: string;
  group_name: string;
  tasks: any[];
}

interface FinanceTabProps {
  groupType: GroupTypes;
  taskGroups: TaskGroup[];
  loading: boolean;
}

const ProjectViewFinance = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<FinanceTabType>('finance');
  const [activeGroup, setActiveGroup] = useState<GroupTypes>('status');
  const [loading, setLoading] = useState(false);
  const [taskGroups, setTaskGroups] = useState<IProjectFinanceGroup[]>([]);

  const fetchTasks = async () => {
    if (!projectId) return;
    
    try {
      setLoading(true);
      const response = await projectFinanceApiService.getProjectTasks(projectId, activeGroup);
      if (response.done) {
        setTaskGroups(response.body);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [projectId, activeGroup]);

  return (
    <Flex vertical gap={16} style={{ overflowX: 'hidden' }}>
      <ProjectViewFinanceHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeGroup={activeGroup}
        setActiveGroup={setActiveGroup}
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
