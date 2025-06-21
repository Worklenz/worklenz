import { Avatar, Drawer, Tabs, TabsProps } from '@/components/ui';
import { useAppSelector } from '@/hooks/use-app-selector';
import { useAppDispatch } from '@/hooks/use-app-dispatch';
import { toggleScheduleDrawer } from '@/features/schedule/schedule-slice';
import { avatarNamesMap } from '@/shared/constants';
import { useTranslation } from 'react-i18next';
import WithStartAndEndDates from '@/components/schedule-old/tabs/withStartAndEndDates/with-start-and-end-dates';

const ScheduleDrawer = () => {
  const isScheduleDrawerOpen = useAppSelector(state => state.scheduleReducer.isScheduleDrawerOpen);
  const dispatch = useAppDispatch();
  const { t } = useTranslation('schedule');

  const items: TabsProps['items'] = [
    {
      key: '1',
      label: '2024-11-04 - 2024-12-24',
      children: <WithStartAndEndDates />,
    },
    {
      key: '2',
      label: t('tabTitle'),
      children: 'Content of Tab Pane 2',
    },
  ];

  return (
    <Drawer
      width={1000}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Avatar style={{ backgroundColor: avatarNamesMap['R'] }}>R</Avatar>
          <span>Raveesha Dilanka</span>
        </div>
      }
      onClose={() => dispatch(toggleScheduleDrawer())}
      open={isScheduleDrawerOpen}
    >
      <Tabs defaultActiveKey="1" type="card" items={items} />
    </Drawer>
  );
};

export default ScheduleDrawer;
