import { Flex } from 'antd';
import React, { useState } from 'react';
import ProjectViewFinanceHeader from './project-view-finance-header/project-view-finance-header';
import FinanceTab from './finance-tab/finance-tab';
import RatecardTab from './ratecard-tab/ratecard-tab';

type FinanceTabType = 'finance' | 'ratecard';
type GroupTypes = 'status' | 'priority' | 'phases';

const ProjectViewFinance = () => {
  const [activeTab, setActiveTab] = useState<FinanceTabType>('finance');
  const [activeGroup, setActiveGroup] = useState<GroupTypes>('status');

  return (
    <Flex vertical gap={16} style={{ overflowX: 'hidden' }}>
      <ProjectViewFinanceHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeGroup={activeGroup}
        setActiveGroup={setActiveGroup}
      />

      {activeTab === 'finance' ? (
        <FinanceTab groupType={activeGroup} />
      ) : (
        <RatecardTab />
      )}
    </Flex>
  );
};

export default ProjectViewFinance;
