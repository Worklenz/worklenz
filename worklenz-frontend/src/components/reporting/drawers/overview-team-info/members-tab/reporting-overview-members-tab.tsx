import { Flex, Skeleton } from '@/shared/antd-imports';
import React, { useEffect, useMemo, useState } from 'react';
import CustomSearchbar from '../../../../CustomSearchbar';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import OverviewReportsMembersTable from './reporting-overview-members-table';
import { IRPTMember } from '@/types/reporting/reporting.types';
import { reportingApiService } from '@/api/reporting/reporting.api.service';

type OverviewReportsMembersTabProps = { teamsId?: string | null };

const OverviewReportsMembersTab = ({ teamsId = null }: OverviewReportsMembersTabProps) => {
  const { t } = useTranslation('reporting-overview-drawer');

  const [searchQuery, setSearchQuery] = useState<string>('');

  return (
    <Flex vertical gap={24}>
      <CustomSearchbar
        placeholderText={t('searchByNameInputPlaceholder')}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {<OverviewReportsMembersTable teamsId={teamsId} searchQuery={searchQuery} />}
    </Flex>
  );
};

export default OverviewReportsMembersTab;
