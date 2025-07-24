import { memo, useEffect, useState, useCallback, useMemo } from 'react';
import { ConfigProvider, Table, TableColumnsType } from '@/shared/antd-imports';
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

const OverviewReportsTable = memo(() => {
  const { t } = useTranslation('reporting-overview');
  const dispatch = useAppDispatch();

  const includeArchivedProjects = useAppSelector(
    state => state.reportingReducer.includeArchivedProjects
  );
  const [selectedTeam, setSelectedTeam] = useState<IRPTTeam | null>(null);
  const [teams, setTeams] = useState<IRPTTeam[]>([]);
  const [loading, setLoading] = useState(false);

  const getTeams = useCallback(async () => {
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
  }, [includeArchivedProjects]);

  useEffect(() => {
    getTeams();
  }, [getTeams]);

  const handleDrawerOpen = useCallback(
    (team: IRPTTeam) => {
      setSelectedTeam(team);
      dispatch(toggleOverViewTeamDrawer());
    },
    [dispatch]
  );

  // Memoize table columns to prevent recreation on every render
  const columns: TableColumnsType<IRPTTeam> = useMemo(
    () => [
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
        render: (record: IRPTTeam) => <Avatars members={record.members} maxCount={3} />,
      },
    ],
    [t]
  );

  // Memoize table configuration
  const tableConfig = useMemo(
    () => ({
      theme: {
        components: {
          Table: {
            cellPaddingBlock: 8,
            cellPaddingInline: 10,
          },
        },
      },
    }),
    []
  );

  // Memoize row props generator
  const getRowProps = useCallback(
    (record: IRPTTeam) => ({
      onClick: () => handleDrawerOpen(record),
      style: { height: 48, cursor: 'pointer' },
      className: 'group even:bg-[#4e4e4e10]',
    }),
    [handleDrawerOpen]
  );

  return (
    <ConfigProvider {...tableConfig}>
      <Table
        columns={columns}
        dataSource={teams}
        scroll={{ x: 'max-content' }}
        rowKey={record => record.id}
        loading={loading}
        onRow={getRowProps}
      />

      <OverviewTeamInfoDrawer team={selectedTeam} />
    </ConfigProvider>
  );
});

OverviewReportsTable.displayName = 'OverviewReportsTable';

export default OverviewReportsTable;
