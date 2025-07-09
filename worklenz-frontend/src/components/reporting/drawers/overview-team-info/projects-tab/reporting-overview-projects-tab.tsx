import { Flex } from 'antd';
import { useState } from 'react';
import CustomSearchbar from '@components/CustomSearchbar';
import { useTranslation } from 'react-i18next';

import ReportingOverviewProjectsTable from './reporting-overview-projects-table';

interface OverviewReportsProjectsTabProps {
  teamsId?: string | null;
}

const OverviewReportsProjectsTab = ({ teamsId = null }: OverviewReportsProjectsTabProps) => {
  const { t } = useTranslation('reporting-projects-drawer');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <Flex vertical gap={24}>
      <CustomSearchbar
        placeholderText={t('searchByNameInputPlaceholder')}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      <ReportingOverviewProjectsTable searchQuery={searchQuery} teamsId={teamsId} />
    </Flex>
  );
};

export default OverviewReportsProjectsTab;
