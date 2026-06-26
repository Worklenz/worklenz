import { SearchOutlined, SyncOutlined } from '@/shared/antd-imports';
import WorklenzPageHeader from '@/components/common/WorklenzPageHeader';
import { Button, Flex, Input, Tooltip } from '@/shared/antd-imports';

import React, { useEffect, useState } from 'react';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  adminCenterApiService,
  IOrganizationTeamRequestParams,
} from '@/api/admin-center/admin-center.api.service';

import { IOrganizationTeam } from '@/types/admin-center/admin-center.types';
import './teams.css';
import TeamsTable from '@/components/admin-center/teams/teams-table/teams-table';

import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import logger from '@/utils/errorLogger';
import { RootState } from '@/app/store';
import { useTranslation } from 'react-i18next';
import AddTeamDrawer from '@/components/admin-center/teams/add-team-drawer/add-team-drawer';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_admin_center_teams_visit } from '@/shared/worklenz-analytics-events';

export interface IRequestParams extends IOrganizationTeamRequestParams {
  total: number;
}

const Teams: React.FC = () => {
  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);
  const { t } = useTranslation('admin-center/teams');
  const { trackMixpanelEvent } = useMixpanelTracking();

  const [showAddTeamDrawer, setShowAddTeamDrawer] = useState(false);

  const [teams, setTeams] = useState<IOrganizationTeam[]>([]);
  const [currentTeam, setCurrentTeam] = useState<IOrganizationTeam | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Add refresh trigger

  const [requestParams, setRequestParams] = useState<IRequestParams>({
    total: 0,
    index: 1,
    size: DEFAULT_PAGE_SIZE,
    field: 'name',
    order: 'desc',
    search: '',
  });

  const fetchTeams = async () => {
    setIsLoading(true);
    try {
      const res = await adminCenterApiService.getOrganizationTeams(requestParams);
      if (res.done) {
        setRequestParams(prev => ({ ...prev, total: res.body.total ?? 0 }));
        const mergedTeams = [...(res.body.data ?? [])];

        // Only add current team if there's no search filter or if it matches the search
        if (res.body.current_team_data) {
          const searchTerm = requestParams.search?.toLowerCase().trim() || '';
          const currentTeamName = res.body.current_team_data.name?.toLowerCase() || '';

          // Add current team if: no search term OR current team name matches search
          const shouldIncludeCurrentTeam = !searchTerm || currentTeamName.includes(searchTerm);

          if (shouldIncludeCurrentTeam) {
            // Check if current team is already in the results to avoid duplicates
            const isCurrentTeamInResults = mergedTeams.some(
              team => team.id === res.body.current_team_data?.id
            );

            if (!isCurrentTeamInResults) {
              mergedTeams.unshift(res.body.current_team_data);
            }
          }
        }

        setTeams(mergedTeams);
        setCurrentTeam(res.body.current_team_data ?? null);
      }
    } catch (error) {
      logger.error('Error fetching teams', error);
    } finally {
      setIsLoading(false);
    }
  };

  const reloadTeams = () => {
    // Trigger refresh by updating the refreshTrigger
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    trackMixpanelEvent(evt_admin_center_teams_visit);
    fetchTeams();
  }, [trackMixpanelEvent]);

  useEffect(() => {
    fetchTeams();
  }, [requestParams.search, refreshTrigger]); // Add refreshTrigger as dependency

  return (
    <div style={{ width: '100%' }}>
      <WorklenzPageHeader title={<span>{t('title')}</span>} style={{ padding: '16px 0' }} />
      <WorklenzPageHeader
        style={{
          paddingLeft: 0,
          paddingTop: 0,
          paddingRight: '24px',
          paddingBottom: '16px',
        }}
        subTitle={
          <span
            style={{
              color: `${themeMode === 'dark' ? '#ffffffd9' : '#000000d9'}`,
              fontWeight: 500,
              fontSize: '16px',
            }}
          >
            {requestParams.total} {t('subtitle')}
          </span>
        }
        extra={
          <Flex gap={8} align="center">
            <Tooltip title={t('tooltip')}>
              <Button
                shape="circle"
                icon={<SyncOutlined spin={isLoading} />}
                onClick={() => reloadTeams()}
              />
            </Tooltip>
            <Input
              placeholder={t('placeholder')}
              suffix={<SearchOutlined />}
              type="text"
              value={requestParams.search ?? ''}
              onChange={e => setRequestParams(prev => ({ ...prev, search: e.target.value }))}
            />
            <Button type="primary" onClick={() => setShowAddTeamDrawer(true)}>
              {t('addTeam')}
            </Button>
          </Flex>
        }
      />

      <TeamsTable
        teams={teams}
        currentTeam={currentTeam}
        t={t}
        loading={isLoading}
        reloadTeams={fetchTeams}
      />

      <AddTeamDrawer
        isDrawerOpen={showAddTeamDrawer}
        onClose={() => setShowAddTeamDrawer(false)}
        reloadTeams={fetchTeams}
      />
    </div>
  );
};

export default Teams;
