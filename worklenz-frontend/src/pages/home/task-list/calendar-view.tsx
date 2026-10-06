import HomeCalendar from '../../../components/calendars/homeCalendar/HomeCalendar';
import { Tag, Typography, Button } from '@/shared/antd-imports';
import { ClockCircleOutlined, CalendarOutlined } from '@ant-design/icons';
import { useAppSelector } from '@/hooks/useAppSelector';
import AddTaskInlineForm from './add-task-inline-form';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { setHomeTasksConfig } from '@/features/home-page/home-page.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import dayjs from 'dayjs';
import { useAuthService } from '@/hooks/useAuth';
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
    <div>
      <Button
        icon={<CalendarOutlined />}
        onClick={() => {
          setEditingTimeOffEntry(null);
          setIsTimeOffModalVisible(true);
        }}
        style={{ marginBottom: 12 }}
      >
        {t('tasks.markTimeOff', { defaultValue: 'Mark Time-Off / Leave' })}
      </Button>

      <HomeCalendar
        onTimeOffClick={entry => {
          setEditingTimeOffEntry(entry);
          setIsTimeOffModalVisible(true);
        }}
      />

      <Tag
        icon={<ClockCircleOutlined style={{ fontSize: 16 }} />}
        color="success"
        style={{
          display: 'flex',
          width: '100%',
          padding: '8px 12px',
          marginBlock: 12,
        }}
      >
        <Typography.Text>
          {t('home:tasks.dueOn')} {homeTasksConfig.selected_date?.format('MMM DD, YYYY')}
        </Typography.Text>
      </Tag>

      <AddTaskInlineForm t={t} calendarView={true} />

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
