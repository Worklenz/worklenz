import { Drawer, Typography, Flex, Button } from 'antd';
import React, { useMemo, useState } from 'react';
import { FileOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { toggleProjectReportsMembersTaskDrawer } from '../../../project-reports-slice';
import { colors } from '@/styles/colors';
import ProjectReportsMembersTasksTable from './ProjectReportsMembersTaskTable';
import CustomSearchbar from '@/components/CustomSearchbar';

const ProjectReportsMembersTaskDrawer = () => {
  const { t } = useTranslation('reporting-projects-drawer');
  const dispatch = useAppDispatch();

  const [taskData, setTaskData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { isProjectReportsMembersTaskDrawerOpen, selectedProject, selectedMember } = useAppSelector(
    state => state.projectReportsReducer
  );

  const handleClose = () => {
    dispatch(toggleProjectReportsMembersTaskDrawer());
  };

  const handleAfterOpenChange = (open: boolean) => {
    if (open) {
    }
  };

  const filteredTaskData = useMemo(() => {
    return taskData.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery, taskData]);

  return (
    <Drawer
      open={isProjectReportsMembersTaskDrawerOpen}
      onClose={handleClose}
      afterOpenChange={handleAfterOpenChange}
      destroyOnClose
      width={900}
      title={
        <Flex align="center" justify="space-between">
          <Flex gap={8} align="center" style={{ fontWeight: 500 }}>
            <FileOutlined style={{ color: colors.lightGray }} />
            <Typography.Text>{selectedProject?.name} /</Typography.Text>
            <Typography.Text>{selectedMember?.name}</Typography.Text>
          </Flex>

          <Button type="primary">{t('exportButton')}</Button>
        </Flex>
      }
    >
      <Flex vertical gap={24}>
        <CustomSearchbar
          placeholderText={t('searchByNameInputPlaceholder')}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        <ProjectReportsMembersTasksTable tasksData={filteredTaskData} />
      </Flex>
    </Drawer>
  );
};

export default ProjectReportsMembersTaskDrawer;
