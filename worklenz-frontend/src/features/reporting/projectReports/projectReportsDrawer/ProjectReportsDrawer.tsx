import { Drawer, Typography, Flex, Button, Dropdown } from '@/shared/antd-imports';
import React, { useState } from 'react';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { useAppDispatch } from '../../../../hooks/useAppDispatch';
import { setSelectedProject, toggleProjectReportsDrawer } from '../project-reports-slice';
import { BankOutlined, DownOutlined } from '@/shared/antd-imports';
import ProjectReportsDrawerTabs from './ProjectReportsDrawerTabs';
import { colors } from '../../../../styles/colors';
import { useTranslation } from 'react-i18next';
import { IRPTProject } from '@/types/reporting/reporting.types';

type ProjectReportsDrawerProps = {
  selectedProject: IRPTProject | null;
};

const ProjectReportsDrawer = ({ selectedProject }: ProjectReportsDrawerProps) => {
  const { t } = useTranslation('reporting-projects-drawer');

  const dispatch = useAppDispatch();

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
            }}
          >
            <Button type="primary" icon={<DownOutlined />} iconPosition="end">
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
