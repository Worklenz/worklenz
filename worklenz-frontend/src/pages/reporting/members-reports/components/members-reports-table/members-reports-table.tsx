import { useEffect, useState } from 'react';
import { ConfigProvider, Table, TableColumnsType } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import CustomTableTitle from '@/components/CustomTableTitle';
import TasksProgressCell from './tablesCells/tasksProgressCell/TasksProgressCell';
import MemberCell from './tablesCells/memberCell/MemberCell';
import {
  fetchMembersData,
  setField,
  setOrder,
  setPagination,
  toggleMembersReportsDrawer,
} from '@/features/reporting/membersReports/membersReportsSlice';
import { useAppSelector } from '@/hooks/useAppSelector';
import MembersReportsDrawer from '@/features/reporting/membersReports/membersReportsDrawer/members-reports-drawer';
import type { TableProps } from 'antd';
import type { IRPTMember } from '@/types/reporting/reporting.types';

const MembersReportsTable = () => {
  const { t } = useTranslation('reporting-members');
  const dispatch = useAppDispatch();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { duration, dateRange } = useAppSelector(state => state.reportingReducer);
  const {
  membersList,
  isLoading,
  total,
  archived,
  searchQuery,
  index,
  pageSize,
  field,
  order,
} = useAppSelector(state => state.membersReportsReducer);

  // function to handle drawer toggle
  const handleDrawerOpen = (id: string) => {
    setSelectedId(id);
    dispatch(toggleMembersReportsDrawer());
  };

  const handleOnChange: NonNullable<TableProps<IRPTMember>['onChange']> = (
    pagination,
    _filters,
    sorter,
    extra
  ) => {
    if (isLoading) return;

    if (extra.action === 'sort') {
      const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;

      dispatch(setField('name'));
      dispatch(
        setOrder(activeSorter?.order === 'descend' ? 'desc' : 'asc')
      );
      dispatch(
        setPagination({
          index: 1,
          pageSize: pagination.pageSize ?? pageSize,
        })
      );

      return;
    }

    if (extra.action === 'paginate') {
      dispatch(
        setPagination({
          index: pagination.current ?? 1,
          pageSize: pagination.pageSize ?? pageSize,
        })
      );
    }
  };

  const columns: TableColumnsType<IRPTMember> = [
    {
      key: 'member',
      title: (
        <CustomTableTitle
          title={t('memberColumn', { defaultValue: 'Member' })}
        />
      ),
      sorter: true,
      sortOrder:
        field === 'name'
          ? order === 'desc'
            ? 'descend'
            : 'ascend'
          : null,
      sortDirections: ['ascend', 'descend', 'ascend'],
      onCell: record => {
        return {
          onClick: () => handleDrawerOpen(record.id),
        };
      },
      render: record => <MemberCell member={record} />,
  },
    {
      key: 'tasksProgress',
      title: <CustomTableTitle title={t('tasksProgressColumn')} />,
      render: record => {
        const { todo, doing, done } = record.tasks_stat;
        return todo || doing || done ? <TasksProgressCell tasksStat={record.tasks_stat} /> : '-';
      },
    },
    {
      key: 'tasksAssigned',
      title: (
        <CustomTableTitle
          title={t('tasksAssignedColumn')}
          tooltip={t('tasksAssignedColumnTooltip')}
        />
      ),
      className: 'text-center group-hover:text-[#1890ff]',
      dataIndex: 'tasks',
      width: 180,
    },
    {
      key: 'overdueTasks',
      title: (
        <CustomTableTitle
          title={t('overdueTasksColumn')}
          tooltip={t('overdueTasksColumnTooltip')}
        />
      ),
      className: 'text-center group-hover:text-[#1890ff]',
      dataIndex: 'overdue',
      width: 180,
    },
    {
      key: 'completedTasks',
      title: (
        <CustomTableTitle
          title={t('completedTasksColumn')}
          tooltip={t('completedTasksColumnTooltip')}
        />
      ),
      className: 'text-center group-hover:text-[#1890ff]',
      dataIndex: 'completed',
      width: 180,
    },
    {
      key: 'ongoingTasks',
      title: (
        <CustomTableTitle
          title={t('ongoingTasksColumn')}
          tooltip={t('ongoingTasksColumnTooltip')}
        />
      ),
      className: 'text-center group-hover:text-[#1890ff]',
      dataIndex: 'ongoing',
      width: 180,
    },
  ];

  useEffect(() => {
    dispatch(fetchMembersData({ duration, dateRange }));
  }, [
    dispatch,
    archived,
    searchQuery,
    duration,
    dateRange,
    index,
    pageSize,
    field,
    order,
  ]);

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
      <Table<IRPTMember>
        columns={columns}
        dataSource={membersList}
        rowKey={record => record.id}
        pagination={{
          current: index,
          pageSize,
          showSizeChanger: true,
          total,
        }}
        onChange={handleOnChange}
        scroll={{ x: 'max-content' }}
        loading={isLoading}
        onRow={record => {
          return {
            style: { height: 48, cursor: 'pointer' },
            className: 'group even:bg-[#4e4e4e10]',
          };
        }}
      />

      <MembersReportsDrawer memberId={selectedId} />
    </ConfigProvider>
  );
};

export default MembersReportsTable;
