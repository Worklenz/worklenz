import React, { memo, useEffect, useMemo, useState } from 'react';
import { ConfigProvider, Table, TableColumnsType } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import CustomTableTitle from '../../../../CustomTableTitle';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { IRPTMember } from '@/types/reporting/reporting.types';

type OverviewReportsMembersReportsTableProps = {
  teamsId: string | null;
  searchQuery: string;
};

const OverviewReportsMembersReportsTable = ({
  teamsId,
  searchQuery,
}: OverviewReportsMembersReportsTableProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [membersList, setMembersList] = useState<IRPTMember[]>([]);
  // localization
  const { t } = useTranslation('reporting-overview-drawer');

  const dispatch = useAppDispatch();

  // function to handle drawer toggle
  const handleDrawerOpen = (id: string) => {
    setSelectedId(id);
    // dispatch(toggleMembersReportsDrawer());
  };

  const getMembersList = async () => {
    if (!teamsId) return;

    const res = await reportingApiService.getOverviewMembersByTeam(teamsId, false);
    if (res.done) {
      setMembersList(res.body);
    }
  };

  const filteredMembersList = useMemo(() => {
    return membersList?.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery, membersList]);

  useEffect(() => {
    getMembersList();
  }, []);

  const columns: TableColumnsType = [
    {
      key: 'name',
      title: <CustomTableTitle title={t('nameColumn')} />,
      className: 'group-hover:text-[#1890ff]',
      dataIndex: 'name',
    },
    {
      key: 'email',
      title: <CustomTableTitle title={t('emailColumn')} />,
      className: 'group-hover:text-[#1890ff]',
      dataIndex: 'email',
    },
    {
      key: 'projects',
      title: <CustomTableTitle title={t('projectsColumn')} />,
      className: 'text-center group-hover:text-[#1890ff]',
      dataIndex: 'projects',
      width: 80,
    },
    {
      key: 'tasks',
      title: <CustomTableTitle title={t('tasksColumn')} />,
      className: 'text-center group-hover:text-[#1890ff]',
      dataIndex: 'tasks',
      width: 80,
    },
    {
      key: 'overdueTasks',
      title: <CustomTableTitle title={t('overdueTasksColumn')} />,
      className: 'text-center group-hover:text-[#1890ff]',
      dataIndex: 'overdue',
      width: 120,
    },
    {
      key: 'completedTasks',
      title: <CustomTableTitle title={t('completedTasksColumn')} />,
      className: 'text-center group-hover:text-[#1890ff]',
      dataIndex: 'completed',
      width: 140,
    },
    {
      key: 'ongoingTasks',
      title: <CustomTableTitle title={t('ongoingTasksColumn')} />,
      className: 'text-center group-hover:text-[#1890ff]',
      dataIndex: 'ongoing',
      width: 120,
    },
  ];

  return (
    <ConfigProvider
      theme={{
        components: {
          Table: {
            cellPaddingBlock: 8,
            cellPaddingInline: 10,
          },
        },
      }}
    >
      <Table
        columns={columns}
        dataSource={filteredMembersList}
        scroll={{ x: 'max-content' }}
        rowKey={record => record.id}
        onRow={record => {
          return {
            style: { height: 38, cursor: 'pointer' },
            className: 'group even:bg-[#4e4e4e10]',
          };
        }}
      />

      {/* <MembersReportsDrawer memberId={selectedId} /> */}
    </ConfigProvider>
  );
};

export default memo(OverviewReportsMembersReportsTable);
