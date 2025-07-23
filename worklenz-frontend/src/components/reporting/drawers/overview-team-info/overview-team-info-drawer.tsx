import { Drawer, Typography, Flex, Button, Dropdown } from '@/shared/antd-imports';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { useAppDispatch } from '../../../../hooks/useAppDispatch';
import { BankOutlined } from '@/shared/antd-imports';
import { colors } from '../../../../styles/colors';
import { useTranslation } from 'react-i18next';

import OverviewTeamInfoDrawerTabs from './overview-team-info-drawer-tabs';
import { toggleOverViewTeamDrawer } from '@/features/reporting/reporting.slice';
import { IRPTTeam } from '@/types/reporting/reporting.types';

type OverviewTeamInfoDrawerProps = {
  team: IRPTTeam | null;
};

const OverviewTeamInfoDrawer = ({ team }: OverviewTeamInfoDrawerProps) => {
  const { t } = useTranslation('reporting-overview-drawer');

  const dispatch = useAppDispatch();

  const isDrawerOpen = useAppSelector(state => state.reportingReducer.showOverViewTeamDrawer);

  const handleClose = () => {
    dispatch(toggleOverViewTeamDrawer());
  };

  return (
    <Drawer
      open={isDrawerOpen}
      destroyOnHidden
      onClose={handleClose}
      width={900}
      title={
        team && (
          <Flex align="center" justify="space-between">
            <Flex gap={4} align="center" style={{ fontWeight: 500 }}>
              <BankOutlined style={{ color: colors.lightGray }} />
              <Typography.Text style={{ fontSize: 16 }}>{team.name}</Typography.Text>
            </Flex>

            {/* <Dropdown
              menu={{
                items: [
                  { key: '1', label: t('projectsButton') },
                  { key: '2', label: t('membersButton') },
                ],
              }}
            >
              <Button type="primary" icon={<DownOutlined />} iconPosition="end">
                {t('exportButton')}
              </Button>
            </Dropdown> */}
          </Flex>
        )
      }
    >
      <OverviewTeamInfoDrawerTabs teamsId={team?.id} />
    </Drawer>
  );
};

export default OverviewTeamInfoDrawer;
