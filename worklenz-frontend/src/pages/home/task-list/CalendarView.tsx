import HomeCalendar from '../../../components/calendars/homeCalendar/HomeCalendar';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useEffect, useState } from 'react';
import { setHomeTasksConfig } from '@/features/home-page/home-page.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import dayjs from 'dayjs';
import { Button } from '@/shared/antd-imports';
import { CalendarOutlined } from '@ant-design/icons';
import { useAuthService } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import TimeOffCalendar, { EditableTimeOffEntry } from '@/components/schedule/task-timeline/TimeOffCalendar';

const CalendarView = () => {
  const dispatch = useAppDispatch();
  const { homeTasksConfig } = useAppSelector(state => state.homePageReducer);
  const { t } = useTranslation('home');
  const currentSession = useAuthService().getCurrentSession();
  const [isTimeOffModalVisible, setIsTimeOffModalVisible] = useState(false);
  const [editingTimeOffEntry, setEditingTimeOffEntry] = useState<EditableTimeOffEntry | null>(null);

  useEffect(() => {
    if (!homeTasksConfig.selected_date) {
      dispatch(
        setHomeTasksConfig({
          ...homeTasksConfig,
          selected_date: dayjs(),
        })
      );
    }
  }, [homeTasksConfig.selected_date, dispatch]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Button
        icon={<CalendarOutlined />}
        onClick={() => {
          setEditingTimeOffEntry(null);
          setIsTimeOffModalVisible(true);
        }}
        style={{ marginBottom: 12, alignSelf: 'flex-start' }}
      >
        {t('tasks.markTimeOff', { defaultValue: 'Mark Time-Off / Leave' })}
      </Button>

      <HomeCalendar
        onTimeOffClick={entry => {
          setEditingTimeOffEntry(entry);
          setIsTimeOffModalVisible(true);
        }}
      />

      <TimeOffCalendar
        members={[
          {
            id: currentSession?.team_member_id || '',
            name: currentSession?.name || '',
            email: currentSession?.email,
          },
        ].filter(member => !!member.id)}
        visible={isTimeOffModalVisible}
        onClose={() => {
          setIsTimeOffModalVisible(false);
          setEditingTimeOffEntry(null);
        }}
        preselectedMemberId={currentSession?.team_member_id || null}
        initialEditingEntry={editingTimeOffEntry}
        dateRange={[
          (homeTasksConfig.selected_date || dayjs()).startOf('month').format('YYYY-MM-DD'),
          (homeTasksConfig.selected_date || dayjs()).endOf('month').format('YYYY-MM-DD'),
        ]}
        showEntriesTable={true}
      />
    </div>
  );
};

export default CalendarView;
