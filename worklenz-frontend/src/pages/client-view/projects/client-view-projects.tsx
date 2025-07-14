import { Flex, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import ProjectsTable from './projects-table';
import { useAppSelector } from '../../../hooks/useAppSelector';

const ClientViewProjects = () => {
  // localization
  const { t } = useTranslation('client-view/client-view-projects');

  // get project list from client view reducer project reducer
  const projectList = useAppSelector(
    (state) => state.clientViewReducer.projectsReducer.projectsList
  );

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" style={{ width: '100%' }}>
        <Typography.Title level={4} style={{ marginBlock: 0 }}>
          {t('title', { items: projectList.length })}
        </Typography.Title>
      </Flex>

      <ProjectsTable />
    </Flex>
  );
};

export default ClientViewProjects;
