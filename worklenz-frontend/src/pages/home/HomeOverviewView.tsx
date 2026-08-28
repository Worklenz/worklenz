import { useState } from 'react';
import Flex from 'antd/es/flex';
import GreetingWithTime from './GreetingWithTime';
import TasksList from '@/pages/home/task-list/TasksList';
import HomeStatCards from './home-stat-cards/HomeStatCards';
import HomeProgressDonut from './home-progress-donut/HomeProgressDonut';
import HomeContinueCard from './home-continue-card/HomeContinueCard';
import PillToggle from './PillToggle';
import { useMediaQuery } from 'react-responsive';
import { useTranslation } from 'react-i18next';

export type HomePeriod = 'today' | 'week';

const DESKTOP_MIN_WIDTH = 1024;

const PeriodToggle: React.FC<{ period: HomePeriod; onChange: (p: HomePeriod) => void }> = ({
  period,
  onChange,
}) => {
  const { t } = useTranslation('home');
  return (
  <PillToggle<HomePeriod>
    value={period}
    onChange={onChange}
    options={[
      { value: 'today', label: t('greeting.today', { defaultValue: 'Today' }) },
      { value: 'week', label: t('greeting.thisWeek', { defaultValue: 'This Week' }) },
    ]}
    equalWidth
    style={{ marginBottom: 14, width: 220 }}
  />
);
};

const HomeOverviewView: React.FC = () => {
  const isDesktop = useMediaQuery({ query: `(min-width: ${DESKTOP_MIN_WIDTH}px)` });
  const [period, setPeriod] = useState<HomePeriod>('today');
  const { t } = useTranslation('home');

  const prioritiesTitle = period === 'today' ? t('greeting.todaysPriorities', { defaultValue: "Today's Priorities" }) : t('greeting.weeksPriorities', { defaultValue: "This Week's Priorities" });

  const leftCol = (
    <Flex vertical gap={12} style={{ flex: 1, minWidth: 0, height: '100%' }}>
      <HomeStatCards period={period} />
      {/* Fills remaining leftCol height down to the bottom of the screen */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <TasksList cardTitle={prioritiesTitle} />
      </div>
    </Flex>
  );

  const rightCol = (
    <Flex vertical gap={12} style={{ width: 320, minWidth: 320, height: '100%' }}>
      <HomeProgressDonut period={period} />
      {/* Fills remaining rightCol height down to the bottom of the screen —
          now the only thing below the donut, since the Projects card was removed */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <HomeContinueCard />
      </div>
    </Flex>
  );

  return (
    <div
      style={{
        padding: '24px',
        flex: 1,
        minWidth: 0,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Greeting banner */}
      <div style={{ marginBottom: 10 }}>
        <GreetingWithTime />
      </div>

      {/* Period toggle */}
      <PeriodToggle period={period} onChange={setPeriod} />

      {isDesktop ? (
        <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flex: 1, minHeight: 0 }}>
          {leftCol}
          {rightCol}
        </div>
      ) : (
        <Flex vertical gap={12}>
          <HomeStatCards period={period} />
          <TasksList cardTitle={prioritiesTitle} />
          <HomeProgressDonut period={period} />
          <HomeContinueCard />
        </Flex>
      )}
    </div>
  );
};

export default HomeOverviewView;
