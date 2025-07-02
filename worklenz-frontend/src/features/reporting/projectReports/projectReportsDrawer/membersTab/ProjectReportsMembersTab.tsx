import { Flex } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import CustomSearchbar from '../../../../../components/CustomSearchbar';
import ProjectReportsMembersTable from './ProjectReportsMembersTable';
import { useTranslation } from 'react-i18next';
import { IRPTOverviewProjectMember } from '@/types/reporting/reporting.types';
import { reportingProjectsApiService } from '@/api/reporting/reporting-projects.api.service';

type ProjectReportsMembersTabProps = {
  projectId?: string | null;
};

const ProjectReportsMembersTab = ({ projectId = null }: ProjectReportsMembersTabProps) => {
  const { t } = useTranslation('reporting-projects-drawer');
  const [membersData, setMembersData] = useState<IRPTOverviewProjectMember[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredMembersData = useMemo(() => {
    return membersData.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery, membersData]);

  const fetchMembersData = async () => {
    if (!projectId || loading) return;

    try {
      setLoading(true);
      const res = await reportingProjectsApiService.getProjectMembers(projectId);
      if (res.done) {
        setMembersData(res.body);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembersData();
  }, [projectId]);

  return (
    <Flex vertical gap={24}>
      <CustomSearchbar
        placeholderText={t('searchByNameInputPlaceholder')}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      <ProjectReportsMembersTable membersData={filteredMembersData} loading={loading} />
    </Flex>
  );
};

export default ProjectReportsMembersTab;
