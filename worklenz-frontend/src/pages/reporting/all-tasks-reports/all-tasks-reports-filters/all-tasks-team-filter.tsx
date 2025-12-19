import { memo, useMemo } from 'react';
import { Button, Checkbox, Dropdown, Flex, Input, Typography } from '@/shared/antd-imports';
import { CaretDownFilled } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  setSelectOrDeselectAllTeams,
  setSelectOrDeselectTeam,
  fetchAllTasks,
} from '@/features/reporting/allTasksReports/all-tasks-reports-slice';

const AllTasksTeamFilter = () => {
  const { t } = useTranslation('reporting-all-tasks');
  const dispatch = useAppDispatch();
  const { teams, loadingTeams } = useAppSelector(state => state.allTasksReportsReducer);

  const selectedCount = useMemo(() => teams.filter(t => t.selected).length, [teams]);
  const allSelected = selectedCount === teams.length && teams.length > 0;

  const handleSelectAll = (checked: boolean) => {
    dispatch(setSelectOrDeselectAllTeams(checked));
    dispatch(fetchAllTasks());
  };

  const handleTeamToggle = (id: string, selected: boolean) => {
    dispatch(setSelectOrDeselectTeam({ id, selected }));
    dispatch(fetchAllTasks());
  };

  const dropdownContent = (
    <Flex vertical gap={8} style={{ padding: 12, minWidth: 200 }}>
      <Flex justify="space-between" align="center">
        <Checkbox checked={allSelected} onChange={e => handleSelectAll(e.target.checked)}>
          {t('selectAll')}
        </Checkbox>
        <Button type="link" size="small" onClick={() => handleSelectAll(false)}>
          {t('clearAll')}
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
  );

  return (
    <Dropdown
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomLeft"
    >
      <Button loading={loadingTeams}>
        <Flex align="center" gap={4}>
          {t('teamsFilter')}
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
