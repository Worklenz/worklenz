import { Button, Card, Flex, Table, TableProps, Tooltip, Typography } from '@/shared/antd-imports';
import PinRouteToNavbarButton from '@components/PinRouteToNavbarButton';
import { useAppSelector } from '@/hooks/useAppSelector';
import { durationDateFormat } from '@utils/durationDateFormat';
import { EditOutlined } from '@/shared/antd-imports';
import { useEffect, useState } from 'react';
import EditTeamModal from '@/components/settings/edit-team-name-modal';
import { useTranslation } from 'react-i18next';

import { fetchTeams } from '@features/teams/teamSlice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { ITeamGetResponse } from '@/types/teams/team.type';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_settings_teams_visit } from '@/shared/worklenz-analytics-events';

const TeamsSettings = () => {
  const { t } = useTranslation('settings/teams');
  const { trackMixpanelEvent } = useMixpanelTracking();
  useDocumentTitle(t('title'));

  const [selectedTeam, setSelectedTeam] = useState<ITeamGetResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { teamsList } = useAppSelector(state => state.teamReducer);
  const dispatch = useAppDispatch();

  useEffect(() => {
    trackMixpanelEvent(evt_settings_teams_visit);
    dispatch(fetchTeams());
  }, [trackMixpanelEvent, dispatch]);

  const columns: TableProps['columns'] = [
    {
      key: 'name',
      title: t('name'),
      render: (record: ITeamGetResponse) => <Typography.Text>{record.name}</Typography.Text>,
    },

    {
      key: 'created',
      title: t('created'),
      render: (record: ITeamGetResponse) => (
        <Typography.Text>{durationDateFormat(record.created_at)}</Typography.Text>
      ),
    },
    {
      key: 'ownsBy',
      title: t('ownsBy'),
      render: (record: ITeamGetResponse) => <Typography.Text>{record.owns_by}</Typography.Text>,
    },
    {
      key: 'actionBtns',
      width: 60,
      render: (record: ITeamGetResponse) => (
        <Tooltip title={t('edit')} trigger={'hover'}>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedTeam(record);
              setIsModalOpen(true);
            }}
          />
        </Tooltip>
      ),
    },
  ];

  const handleCancel = () => {
    setSelectedTeam(null);
    setIsModalOpen(false);
  };

  return (
    <div style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" style={{ marginBlockEnd: 24 }}>
        <Typography.Title level={4} style={{ marginBlockEnd: 0 }}>
          {teamsList.length} {teamsList.length === 1 ? t('team') : t('teams')}
        </Typography.Title>

        <Tooltip title={t('pinTooltip')} trigger={'hover'}>
          {/* this button pin this route to navbar  */}
          <PinRouteToNavbarButton name="teams" path="/worklenz/settings/teams" adminOnly={true} />
        </Tooltip>
      </Flex>

      <Card style={{ width: '100%' }}>
        <Table<ITeamGetResponse>
          className="custom-two-colors-row-table"
          columns={columns}
          dataSource={teamsList}
          rowKey={record => record.id ?? ''}
          pagination={{
            showSizeChanger: true,
            defaultPageSize: 20,
          }}
        />
      </Card>

      {/* edit team name modal */}
      <EditTeamModal team={selectedTeam} isModalOpen={isModalOpen} onCancel={handleCancel} />
    </div>
  );
};

export default TeamsSettings;
