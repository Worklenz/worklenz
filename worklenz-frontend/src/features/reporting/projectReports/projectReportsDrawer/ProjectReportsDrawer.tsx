import { Drawer, Typography, Flex, Button, Dropdown } from '@/shared/antd-imports';
import React, { useState, useCallback } from 'react';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { useAppDispatch } from '../../../../hooks/useAppDispatch';
import { setSelectedProject, toggleProjectReportsDrawer } from '../project-reports-slice';
import { BankOutlined, DownOutlined } from '@/shared/antd-imports';
import ProjectReportsDrawerTabs from './ProjectReportsDrawerTabs';
import { colors } from '../../../../styles/colors';
import { useTranslation } from 'react-i18next';
import { IRPTProject } from '@/types/reporting/reporting.types';
import { useAuthService } from '../../../../hooks/useAuth';
import { reportingExportApiService } from '@/api/reporting/reporting-export.api.service';

type ProjectReportsDrawerProps = {
  selectedProject: IRPTProject | null;
};

const ProjectReportsDrawer = ({ selectedProject }: ProjectReportsDrawerProps) => {
  const { t } = useTranslation('reporting-projects-drawer');

  const dispatch = useAppDispatch();
  const currentSession = useAuthService().getCurrentSession();
  const [exporting, setExporting] = useState<boolean>(false);

  // get drawer open state and project list from the reducer
  const isDrawerOpen = useAppSelector(
    state => state.projectReportsReducer.isProjectReportsDrawerOpen
  );
  const { projectList } = useAppSelector(state => state.projectReportsReducer);

  // function to handle drawer close
  const handleClose = () => {
    dispatch(toggleProjectReportsDrawer());
  };

  const handleAfterOpenChange = (open: boolean) => {
    if (open) {
      dispatch(setSelectedProject(selectedProject));
    }
  };

  // Export handlers
  const handleExportMembers = useCallback(() => {
    if (!selectedProject?.id) return;
    try {
      setExporting(true);
      const teamName = currentSession?.team_name || 'Team';
      reportingExportApiService.exportProjectMembers(
        selectedProject.id,
        selectedProject.name,
        teamName
      );
    } catch (error) {
      console.error('Error exporting project members:', error);
    } finally {
      setExporting(false);
    }
  }, [selectedProject, currentSession?.team_name]);

  const handleExportTasks = useCallback(() => {
    if (!selectedProject?.id) return;
    try {
      setExporting(true);
      const teamName = currentSession?.team_name || 'Team';
      reportingExportApiService.exportProjectTasks(
        selectedProject.id,
        selectedProject.name,
        teamName
      );
    } catch (error) {
      console.error('Error exporting project tasks:', error);
    } finally {
      setExporting(false);
    }
  }, [selectedProject, currentSession?.team_name]);

  const handleExportClick = useCallback((key: string) => {
    switch (key) {
      case '1':
        handleExportMembers();
        break;
      case '2':
        handleExportTasks();
        break;
      default:
        break;
    }
  }, [handleExportMembers, handleExportTasks]);

  return (
    <Drawer
      open={isDrawerOpen}
      onClose={handleClose}
      afterOpenChange={handleAfterOpenChange}
      destroyOnClose
      width={900}
      title={
        <Flex align="center" justify="space-between">
          <Flex gap={8} align="center" style={{ fontWeight: 500 }}>
            <BankOutlined style={{ color: colors.lightGray }} />
            <Typography.Text>/</Typography.Text>
            <Typography.Text>{selectedProject?.name}</Typography.Text>
          </Flex>

          <Dropdown
            menu={{
              items: [
                { key: '1', label: t('membersButton') },
                { key: '2', label: t('tasksButton') },
              ],
              onClick: ({ key }) => handleExportClick(key),
            }}
          >
            <Button 
              type="primary" 
              loading={exporting}
              icon={<DownOutlined />} 
              iconPosition="end"
            >
              {t('exportButton')}
            </Button>
          </Dropdown>
        </Flex>
      }
    >
      {selectedProject && <ProjectReportsDrawerTabs projectId={selectedProject.id} />}
    </Drawer>
  );
};

export default ProjectReportsDrawer;
