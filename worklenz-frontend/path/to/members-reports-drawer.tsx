import MembersReportsTimeLogsTab from './members-reports-time-logs-tab';

type MembersReportsDrawerProps = {
  memberId: string | null;
  exportTimeLogs: () => void;
};

const MembersReportsDrawer = ({ memberId, exportTimeLogs }: MembersReportsDrawerProps) => {
  return (
    <Drawer
      open={isDrawerOpen}
      onClose={handleClose}
      width={900}
      destroyOnClose
      title={
        selectedMember && (
          <Flex align="center" justify="space-between">
            <Flex gap={8} align="center" style={{ fontWeight: 500 }}>
              <Typography.Text>{selectedMember.name}</Typography.Text>
            </Flex>

            <Space>
              <TimeWiseFilter />
              <Dropdown
                menu={{
                  items: [
                    { key: '1', label: t('timeLogsButton'), onClick: exportTimeLogs },
                    { key: '2', label: t('activityLogsButton') },
                    { key: '3', label: t('tasksButton') },
                  ],
                }}
              >
                <Button type="primary" icon={<DownOutlined />} iconPosition="end">
                  {t('exportButton')}
                </Button>
              </Dropdown>
            </Space>
          </Flex>
        )
      }
    >
      {selectedMember && <MembersReportsDrawerTabs memberId={selectedMember.id} />}
      {selectedMember && <MembersOverviewTasksStatsDrawer memberId={selectedMember.id} />}
      {selectedMember && <MembersOverviewProjectsStatsDrawer memberId={selectedMember.id} />}
    </Drawer>
  );
};

export default MembersReportsDrawer; 