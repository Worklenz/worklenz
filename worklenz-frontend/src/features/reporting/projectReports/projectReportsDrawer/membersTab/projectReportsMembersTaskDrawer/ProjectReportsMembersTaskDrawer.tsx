import { Drawer, Typography, Flex, Button, Spin } from '@/shared/antd-imports';
import { useMemo, useState, useEffect, useCallback, Suspense } from 'react';
import { FileOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { toggleProjectReportsMembersTaskDrawer } from '../../../project-reports-slice';
import { colors } from '@/styles/colors';
import ProjectReportsMembersTasksTable from './ProjectReportsMembersTaskTable';
import CustomSearchbar from '@/components/CustomSearchbar';
import { reportingProjectsApiService } from '@/api/reporting/reporting-projects.api.service';
import { reportingExportApiService } from '@/api/reporting/reporting-export.api.service';
import { useAuthService } from '@/hooks/useAuth';
import logger from '@/utils/errorLogger';
import { IRPTOverviewProjectMember } from '@/types/reporting/reporting.types';

type ProjectReportsMembersTaskDrawerProps = {
  selectedMember: IRPTOverviewProjectMember | null;
};

const ProjectReportsMembersTaskDrawer = ({ selectedMember }: ProjectReportsMembersTaskDrawerProps) => {
  const { t } = useTranslation('reporting-projects-drawer');
  const dispatch = useAppDispatch();
  const currentSession = useAuthService().getCurrentSession();

  const [taskData, setTaskData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { isProjectReportsMembersTaskDrawerOpen, selectedProject } = useAppSelector(
    state => state.projectReportsReducer
  );
  const { includeArchivedProjects } = useAppSelector(state => state.reportingReducer);

  const handleClose = () => {
    dispatch(toggleProjectReportsMembersTaskDrawer());
  };

  const fetchMemberTasks = useCallback(async () => {
    if (!selectedMember?.team_member_id || !selectedProject?.id) {
      setTaskData([]);
      return;
    }

    setLoading(true);
    try {
      const response = await reportingProjectsApiService.getMemberTasks(
        selectedMember.team_member_id,
        selectedProject.id,
        {
          archived: includeArchivedProjects,
        }
      );

      if (response.done) {
        setTaskData(response.body || []);
      }
    } catch (error) {
      logger.error('fetchMemberTasks', error);
      setTaskData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMember?.team_member_id, selectedProject?.id, includeArchivedProjects]);

  useEffect(() => {
    if (isProjectReportsMembersTaskDrawerOpen && selectedMember) {
      fetchMemberTasks();
    } else if (!isProjectReportsMembersTaskDrawerOpen) {
      // Reset data when drawer closes
      setTaskData([]);
      setSearchQuery('');
    }
  }, [isProjectReportsMembersTaskDrawerOpen, selectedMember, fetchMemberTasks]);

  const handleExport = useCallback(() => {
    if (!selectedMember?.team_member_id || !selectedProject?.id) {
      logger.error('exportProjectMemberTasks - Missing required data', {
        hasMemberId: !!selectedMember?.team_member_id,
        hasProjectId: !!selectedProject?.id,
        selectedMember,
        selectedProject,
      });
      return;
    }

    try {
      setExporting(true);
      const teamName = currentSession?.team_name || 'Team';

      reportingExportApiService.exportProjectMemberTasks(
        selectedMember.team_member_id,
        selectedMember.name,
        selectedProject.id,
        selectedProject.name || 'Unknown Project',
        teamName,
        includeArchivedProjects
      );
    } catch (error) {
      logger.error('exportProjectMemberTasks', error);
    } finally {
      setExporting(false);
    }
  }, [
    selectedMember?.team_member_id,
    selectedMember?.name,
    selectedProject?.id,
    selectedProject?.name,
    currentSession?.team_name,
    includeArchivedProjects,
  ]);

  const filteredTaskData = useMemo(() => {
    if (!searchQuery.trim()) {
      return taskData;
    }
    return taskData.filter(item =>
      item.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, taskData]);

  return (
    <Drawer
      open={isProjectReportsMembersTaskDrawerOpen}
      onClose={handleClose}
      destroyOnHidden
      width={900}
      title={
        <Flex align="center" justify="space-between">
          <Flex gap={8} align="center" style={{ fontWeight: 500 }}>
            <FileOutlined style={{ color: colors.lightGray }} />
            <Typography.Text>{selectedProject?.name} /</Typography.Text>
            <Typography.Text>{selectedMember?.name}</Typography.Text>
          </Flex>

          <Button
            type="primary"
            loading={exporting}
            onClick={handleExport}
            disabled={!taskData || taskData.length === 0}
          >
            {t('exportButton', { defaultValue: 'Export' })}
          </Button>
        </Flex>
      }
    >
      <Flex vertical gap={24}>
        <CustomSearchbar
          placeholderText={t('searchByNameInputPlaceholder', { defaultValue: 'Search by name' })}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        <Suspense
          fallback={
            <Flex justify="center" align="center" style={{ minHeight: 200 }}>
              <Spin size="large" />
            </Flex>
          }
        >
          <ProjectReportsMembersTasksTable tasksData={filteredTaskData} loading={loading} />
        </Suspense>
      </Flex>
    </Drawer>
  );
};

export default ProjectReportsMembersTaskDrawer;
