import { useCallback, useEffect, useState } from 'react';
import Flex from 'antd/es/flex';
import GreetingWithTime from './GreetingWithTime';
import TasksList from '@/pages/home/task-list/TasksList';
import HomeStatCards from './home-stat-cards/HomeStatCards';
import HomeProgressDonut from './home-progress-donut/HomeProgressDonut';
import HomeContinueCard from './home-continue-card/HomeContinueCard';
import HomeTeamMembersWidget from './home-team-members-widget/HomeTeamMembersWidget';
import HomeAssignedByMeWidget from './home-assigned-by-me-widget/HomeAssignedByMeWidget';
import HomeMentionsWidget from './home-mentions-widget/HomeMentionsWidget';
import HomeTodoWidget from './home-todo-widget/HomeTodoWidget';
import { AddWidgetButton } from './home-widgets/AddWidgetButton';
import { HomeGreetingFrame } from './home-widgets/HomeGreetingFrame';
import { HomeWidgetBoard } from './home-widgets/HomeWidgetBoard';
import { HomeWidgetDnd } from './home-widgets/HomeWidgetDnd';
import { useHomePreferencesSync } from './home-layout/useHomePreferencesSync';
import {
  addSection,
  HOME_GREETING_ID,
  isGreetingVisible,
  removeSection,
  type HomeLayout,
  type HomeSectionId,
  type HomeWidgetId,
} from './home-layout/homeLayout';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  selectHomeLayout,
  setHomeLayout,
  type HomePeriod,
} from '@/features/home-page/homePreferences.slice';
import { useMediaQuery } from 'react-responsive';
import { useTranslation } from 'react-i18next';

export type { HomePeriod };

const DESKTOP_MIN_WIDTH = 1024;
/** How long a freshly added widget stays highlighted. */
const JUST_ADDED_HIGHLIGHT_MS = 2000;

const HomeOverviewView: React.FC = () => {
  const dispatch = useAppDispatch();
  const isDesktop = useMediaQuery({ query: `(min-width: ${DESKTOP_MIN_WIDTH}px)` });
  const isReady = useHomePreferencesSync();
  const selections = useAppSelector(state => state.homePreferencesReducer.selections);
  // The saved layout, or the live preview of one while a draft is being previewed.
  const layout = useAppSelector(selectHomeLayout);
  const [justAddedId, setJustAddedId] = useState<HomeWidgetId | null>(null);
  const { t } = useTranslation('home');

  const period = selections.period;
  const prioritiesTitle = period === 'today' ? t('greeting.todaysPriorities', { defaultValue: "Today's Priorities" }) : t('greeting.weeksPriorities', { defaultValue: "This Week's Priorities" });

  // Moving, adding and removing widgets on the page are saved straight away, like the period choice.
  const handleLayoutChange = useCallback((next: HomeLayout) => dispatch(setHomeLayout(next)), [dispatch]);

  const handleAddSection = useCallback(
    (id: HomeSectionId) => {
      handleLayoutChange(addSection(layout, id));
      // The greeting banner has no box to highlight; it simply appears at the top.
      if (id !== HOME_GREETING_ID) setJustAddedId(id);
    },
    [handleLayoutChange, layout]
  );

  const handleRemoveGreeting = useCallback(
    () => handleLayoutChange(removeSection(layout, HOME_GREETING_ID)),
    [handleLayoutChange, layout]
  );

  useEffect(() => {
    if (!justAddedId) return;
    const timer = setTimeout(() => setJustAddedId(null), JUST_ADDED_HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [justAddedId]);

  const renderWidgetContent = (id: HomeWidgetId) => {
    switch (id) {
      case 'stat-cards':
        return <HomeStatCards period={period} />;
      case 'priorities':
        return <TasksList cardTitle={prioritiesTitle} />;
      case 'progress-donut':
        return <HomeProgressDonut period={period} />;
      case 'continue':
        return <HomeContinueCard />;
      case 'team-members':
        return <HomeTeamMembersWidget />;
      case 'assigned-by-me':
        return <HomeAssignedByMeWidget />;
      case 'mentions':
        return <HomeMentionsWidget />;
      case 'todo':
        return <HomeTodoWidget />;
    }
  };

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
      {/* One drag context for the whole page, so a widget can be dragged out of the "Add widget"
          menu in the toolbar onto the board below it. It renders no element of its own. */}
      <HomeWidgetDnd
        layout={layout}
        isEnabled={isDesktop}
        onLayoutChange={handleLayoutChange}
        onWidgetAdded={setJustAddedId}
      >
        {isGreetingVisible(layout) && (
          <div style={{ marginBottom: 10 }}>
            <HomeGreetingFrame onRemove={handleRemoveGreeting}>
              <GreetingWithTime />
            </HomeGreetingFrame>
          </div>
        )}

        <Flex justify="flex-end" style={{ marginBottom: 14 }}>
          {/* The period is chosen from the "..." menu of the widgets that show one. */}
          <AddWidgetButton layout={layout} onAdd={handleAddSection} isDragEnabled={isDesktop} />
        </Flex>

        {/* Nothing below renders until the saved layout and pins are loaded (a synchronous read
            today), so the page never flashes the default layout or fires a request with the
            wrong tab. */}
        {isReady && (
          <HomeWidgetBoard
            layout={layout}
            isDesktop={isDesktop}
            onLayoutChange={handleLayoutChange}
            renderWidget={renderWidgetContent}
            justAddedId={justAddedId}
            onAddSection={handleAddSection}
          />
        )}
      </HomeWidgetDnd>
    </div>
  );
};

export default HomeOverviewView;
