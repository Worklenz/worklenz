import { memo, useMemo } from 'react';
import { Button, Card, Checkbox, Dropdown, Flex, Typography } from '@/shared/antd-imports';
import { CaretDownFilled } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { IRPTTeam } from '@/types/reporting/reporting.types';

interface Props {
  teams: IRPTTeam[];
  selectedTeams: string[];
  loading?: boolean;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
}

const ReportingTeamsFilter = ({ teams, selectedTeams, loading, disabled, onChange }: Props) => {
  const { t } = useTranslation('reporting-all-tasks');

  const allSelected = useMemo(
    () => teams.length > 0 && selectedTeams.length === teams.length,
    [teams, selectedTeams]
  );
  const selectedCount = selectedTeams.length;

  const handleSelectAll = (checked: boolean) => {
    onChange(checked ? teams.map(tm => tm.id as string) : []);
  };

  const handleToggle = (id: string, checked: boolean) => {
    onChange(checked ? [...selectedTeams, id] : selectedTeams.filter(s => s !== id));
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
              key={team.id as string}
              checked={selectedTeams.includes(team.id as string)}
              onChange={e => handleToggle(team.id as string, e.target.checked)}
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
      disabled={disabled}
    >
      <Button loading={loading} disabled={loading}>
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

export default memo(ReportingTeamsFilter);
