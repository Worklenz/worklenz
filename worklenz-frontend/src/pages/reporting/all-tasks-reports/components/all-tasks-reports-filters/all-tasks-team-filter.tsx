import { memo, useMemo } from 'react';
import { Button, Card, Checkbox, Dropdown, Flex, Typography } from '@/shared/antd-imports';
import { CaretDownFilled } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  setSelectOrDeselectAllTeams,
  setSelectOrDeselectTeam,
  fetchAllTasks,
  setTeamsAndFetch,
} from '@/features/reporting/allTasksReports/all-tasks-reports-slice';

const AllTasksTeamFilter = () => {
  const { t } = useTranslation('reporting-all-tasks');
  const dispatch = useAppDispatch();
  const { teams, loadingTeams } = useAppSelector(state => state.allTasksReportsReducer);

  const selectedCount = useMemo(() => teams.filter(t => t.selected).length, [teams]);
  const allSelected = selectedCount === teams.length && teams.length > 0;

  // BUG FIX: Previously, dispatch(setSelectOrDeselectAllTeams(checked)) and
  // dispatch(fetchAllTasks()) were called back-to-back. Because fetchAllTasks
  // reads from Redux state via getState(), and the state update from
  // setSelectOrDeselectAllTeams had not yet been committed when fetchAllTasks
  // ran, the thunk always read the *old* team selection — so unchecking all
  // teams still sent the previously-selected team IDs (or all IDs) to the API.
  //
  // Fix: use a single thunk (setTeamsAndFetch) that updates the teams state
  // first and then reads the fresh state before building the API request.
  const handleSelectAll = (checked: boolean) => {
    dispatch(setTeamsAndFetch({ type: 'all', selected: checked }));
  };

  const handleTeamToggle = (id: string, selected: boolean) => {
    dispatch(setTeamsAndFetch({ type: 'single', id, selected }));
  };

  const dropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8, width: 240 } }}>
      <Flex vertical gap={8}>
        <Flex justify="space-between" align="center">
          <Checkbox checked={allSelected} onChange={e => handleSelectAll(e.target.checked)}>
            {t('selectAll', { defaultValue: 'Select All' })}
          </Checkbox>
          <Button type="link" size="small" onClick={() => handleSelectAll(false)}>
            {t('clearAll', { defaultValue: 'Clear All' })}
          </Button>
        </Flex>
        <Flex vertical gap={4} style={{ maxHeight: 200, overflowY: 'auto' }}>
          {teams.map(team => (
            <Checkbox
              key={team.id}
              checked={team.selected}
              onChange={e => handleTeamToggle(team.id as string, e.target.checked)}
            >
              {team.name}
            </Checkbox>
          ))}
        </Flex>
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomLeft"
    >
      <Button loading={loadingTeams}>
        <Flex align="center" gap={4}>
          {t('teamsFilter', { defaultValue: 'Teams' })}
          {selectedCount > 0 && selectedCount < teams.length && (
            <Typography.Text type="secondary">({selectedCount})</Typography.Text>
          )}
          <CaretDownFilled />
        </Flex>
      </Button>
    </Dropdown>
  );
};

export default memo(AllTasksTeamFilter);