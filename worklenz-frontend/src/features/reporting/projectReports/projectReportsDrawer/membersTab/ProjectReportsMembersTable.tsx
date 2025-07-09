import { Progress, Table, TableColumnsType } from 'antd';
import React from 'react';
import CustomTableTitle from '../../../../../components/CustomTableTitle';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setSelectedMember,
  toggleProjectReportsMembersTaskDrawer,
} from '../../project-reports-slice';
import { useTranslation } from 'react-i18next';
import ProjectReportsMembersTaskDrawer from './projectReportsMembersTaskDrawer/ProjectReportsMembersTaskDrawer';
import { createPortal } from 'react-dom';
import { IRPTOverviewProjectMember } from '@/types/reporting/reporting.types';

type ProjectReportsMembersTableProps = {
  membersData: any[];
  loading: boolean;
};

const ProjectReportsMembersTable = ({ membersData, loading }: ProjectReportsMembersTableProps) => {
  // localization
  const { t } = useTranslation('reporting-projects-drawer');

  const dispatch = useAppDispatch();

  // function to handle task drawer open
  const handleProjectReportsMembersTaskDrawer = (record: IRPTOverviewProjectMember) => {
    dispatch(setSelectedMember(record));
    dispatch(toggleProjectReportsMembersTaskDrawer());
  };

  const columns: TableColumnsType = [
    {
      key: 'name',
      title: <CustomTableTitle title={t('nameColumn')} />,
      onCell: (record: any) => {
        return {
          onClick: () => handleProjectReportsMembersTaskDrawer(record as IRPTOverviewProjectMember),
        };
      },
      dataIndex: 'name',
      width: 260,
      className: 'group-hover:text-[#1890ff]',
      fixed: 'left' as const,
    },
    {
      key: 'tasksCount',
      title: <CustomTableTitle title={t('tasksCountColumn')} />,
      className: 'text-center group-hover:text-[#1890ff]',
      dataIndex: 'tasks_count',
      width: 120,
    },
    {
      key: 'completedTasks',
      title: <CustomTableTitle title={t('completedTasksColumn')} />,
      className: 'text-center group-hover:text-[#1890ff]',
      dataIndex: 'completed',
      width: 120,
    },
    {
      key: 'incompleteTasks',
      title: <CustomTableTitle title={t('incompleteTasksColumn')} />,
      className: 'text-center group-hover:text-[#1890ff]',
      dataIndex: 'incompleted',
      width: 120,
    },
    {
      key: 'overdueTasks',
      title: <CustomTableTitle title={t('overdueTasksColumn')} />,
      className: 'text-center group-hover:text-[#1890ff]',
      dataIndex: 'overdue',
      width: 120,
    },
    {
      key: 'contribution',
      title: <CustomTableTitle title={t('contributionColumn')} />,
      render: record => {
        return <Progress percent={record.contribution} />;
      },
      width: 180,
    },
    {
      key: 'progress',
      title: <CustomTableTitle title={t('progressColumn')} />,
      render: record => {
        return <Progress percent={record.progress} />;
      },
      width: 180,
    },
    {
      key: 'loggedTime',
      title: <CustomTableTitle title={t('loggedTimeColumn')} />,
      className: 'text-center group-hover:text-[#1890ff]',
      dataIndex: 'time_logged',
      width: 120,
    },
  ];

  return (
    <>
      <Table
        columns={columns}
        dataSource={membersData}
        pagination={false}
        scroll={{ x: 'max-content' }}
        loading={loading}
        onRow={record => {
          return {
            style: { height: 38, cursor: 'pointer' },
            className: 'group even:bg-[#4e4e4e10]',
          };
        }}
      />
      {createPortal(
        <ProjectReportsMembersTaskDrawer />,
        document.body,
        'project-reports-members-task-drawer'
      )}
    </>
  );
};

export default ProjectReportsMembersTable;
