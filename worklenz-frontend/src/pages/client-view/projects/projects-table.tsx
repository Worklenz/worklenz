import {
  Avatar,
  Card,
  Progress,
  Table,
  TableProps,
  Tooltip,
  Typography,
} from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { durationDateFormat } from '../../../utils/durationDateFormat';
import CustomAvatar from '../../../components/CustomAvatar';
import { useAppSelector } from '../../../hooks/useAppSelector';

const ProjectsTable = () => {
  // localization
  const { t } = useTranslation('client-view/client-view-projects');

  // get project list from client view reducer project reducer
  const projectList = useAppSelector(
    (state) => state.clientViewReducer.projectsReducer.projectsList
  );

  // table columns
  const columns: TableProps['columns'] = [
    {
      key: 'name',
      title: t('table.header.name'),
      render: (record) => <Typography.Text>{record.name}</Typography.Text>,
      sorter: (a, b) => a.name.length - b.name.length,
    },
    {
      key: 'status',
      title: t('table.header.status'),
      render: (record) => <Typography.Text>{record.status}</Typography.Text>,
    },
    {
      key: 'taskProgress',
      title: t('table.header.taskProgress'),
      render: (text, record) => {
        const { totalTasks, completedTasks } = record;
        const percent =
          totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        return (
          <Tooltip title={`${completedTasks} / ${totalTasks} tasks completed.`}>
            <Progress percent={percent} className="project-progress" />
          </Tooltip>
        );
      },
    },
    {
      key: 'lastUpdates',
      title: t('table.header.lastUpdates'),
      sorter: (a, b) =>
        new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime(),
      showSorterTooltip: false,
      render: (record) => {
        return durationDateFormat(record.lastUpdated);
      },
    },
    {
      key: 'members',
      title: t('table.header.members'),
      render: (record) => (
        <Avatar.Group>
          {record?.members.map((member: string, index: number) => (
            <CustomAvatar key={index} avatarName={member} />
          ))}
        </Avatar.Group>
      ),
    },
  ];
  return (
    <Card style={{ height: 'calc(100vh - 280px)' }}>
      <Table
        columns={columns}
        dataSource={projectList}
        pagination={{
          size: 'small',
        }}
        scroll={{
          x: 'max-content',
        }}
        onRow={(record) => {
          return {
            style: { cursor: 'pointer' },
          };
        }}
      />
    </Card>
  );
};

export default ProjectsTable;
