import { memo, useEffect, useState } from 'react';
import { ConfigProvider, Table, TableColumnsType } from 'antd';
import { useAppDispatch } from '../../../../hooks/useAppDispatch';
import CustomTableTitle from '../../../../components/CustomTableTitle';
import { useTranslation } from 'react-i18next';
import { IRPTTeam } from '@/types/reporting/reporting.types';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { useAppSelector } from '@/hooks/useAppSelector';
import logger from '@/utils/errorLogger';
import Avatars from '@/components/avatars/avatars';
import OverviewTeamInfoDrawer from '@/components/reporting/drawers/overview-team-info/overview-team-info-drawer';
import { toggleOverViewTeamDrawer } from '@/features/reporting/reporting.slice';

const OverviewReportsTable = () => {
  const { t } = useTranslation('reporting-overview');
  const dispatch = useAppDispatch();

  const includeArchivedProjects = useAppSelector(
    state => state.reportingReducer.includeArchivedProjects
  );
  const [selectedTeam, setSelectedTeam] = useState<IRPTTeam | null>(null);
  const [teams, setTeams] = useState<IRPTTeam[]>([]);
  const [loading, setLoading] = useState(false);

  const getTeams = async () => {
    setLoading(true);
    try {
      const { done, body } = await reportingApiService.getOverviewTeams(includeArchivedProjects);
      if (done) {
        setTeams(body);
      }
    } catch (error) {
      logger.error('getTeams', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getTeams();
  }, [includeArchivedProjects]);

  const handleDrawerOpen = (team: IRPTTeam) => {
    setSelectedTeam(team);
    dispatch(toggleOverViewTeamDrawer());
  };

  const columns: TableColumnsType = [
    {
      key: 'name',
      title: <CustomTableTitle title={t('nameColumn')} />,
      className: 'group-hover:text-[#1890ff]',
      dataIndex: 'name',
    },
    {
      key: 'projects',
      title: <CustomTableTitle title={t('projectsColumn')} />,
      className: 'group-hover:text-[#1890ff]',
      dataIndex: 'projects_count',
    },
    {
      key: 'members',
      title: <CustomTableTitle title={t('membersColumn')} />,
      render: record => <Avatars members={record.members} maxCount={3} />,
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
        dataSource={teams}
        scroll={{ x: 'max-content' }}
        rowKey={record => record.id}
        loading={loading}
        onRow={record => {
          return {
            onClick: () => handleDrawerOpen(record as IRPTTeam),
            style: { height: 48, cursor: 'pointer' },
            className: 'group even:bg-[#4e4e4e10]',
          };
        }}
      />

      <OverviewTeamInfoDrawer team={selectedTeam} />
    </ConfigProvider>
  );
};

export default memo(OverviewReportsTable);
