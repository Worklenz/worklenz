import React, { useEffect, memo, useMemo, useCallback } from 'react';
import { useMediaQuery } from 'react-responsive';
import Col from 'antd/es/col';
import Flex from 'antd/es/flex';
import Row from 'antd/es/row';
import Card from 'antd/es/card';

import GreetingWithTime from './greeting-with-time';
import TasksList from '@/pages/home/task-list/tasks-list';
import ProjectDrawer from '@/components/projects/project-drawer/project-drawer';
import CreateProjectButton from '@/components/projects/project-create-button/project-create-button';
import RecentAndFavouriteProjectList from '@/pages/home/recent-and-favourite-project-list/recent-and-favourite-project-list';
import TodoList from './todo-list/todo-list';

import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAuthService } from '@/hooks/useAuth';

import { fetchProjectStatuses } from '@/features/projects/lookups/projectStatuses/projectStatusesSlice';
import { fetchProjectCategories } from '@/features/projects/lookups/projectCategories/projectCategoriesSlice';
import { fetchProjectHealth } from '@/features/projects/lookups/projectHealth/projectHealthSlice';
import { fetchProjects } from '@/features/home-page/home-page.slice';
import { createPortal } from 'react-dom';
import UserActivityFeed from './user-activity-feed/user-activity-feed';

const DESKTOP_MIN_WIDTH = 1024;
const TASK_LIST_MIN_WIDTH = 500;
const SIDEBAR_MAX_WIDTH = 400;

// Lazy load heavy components
const TaskDrawer = React.lazy(() => import('@/components/task-drawer/task-drawer'));
const SurveyPromptModal = React.lazy(() =>
  import('@/components/survey/SurveyPromptModal').then(m => ({ default: m.SurveyPromptModal }))
);

const HomePage = memo(() => {
  const dispatch = useAppDispatch();
  const isDesktop = useMediaQuery({ query: `(min-width: ${DESKTOP_MIN_WIDTH}px)` });
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();

  useDocumentTitle('Home');

  // Preload TaskDrawer component to prevent dynamic import failures
  useEffect(() => {
    const preloadTaskDrawer = async () => {
      try {
        await import('@/components/task-drawer/task-drawer');
      } catch (error) {
        console.warn('Failed to preload TaskDrawer:', error);
      }
    };

    preloadTaskDrawer();
  }, []);

  // Memoize fetch function to prevent recreation on every render
  const fetchLookups = useCallback(async () => {
    const fetchPromises = [
      dispatch(fetchProjectHealth()),
      dispatch(fetchProjectCategories()),
      dispatch(fetchProjectStatuses()),
      dispatch(fetchProjects()),
    ].filter(Boolean);

    await Promise.all(fetchPromises);
  }, [dispatch]);

  useEffect(() => {
    fetchLookups();
  }, [fetchLookups]);

  // Memoize project drawer close handler
  const handleProjectDrawerClose = useCallback(() => {}, []);

  // Memoize desktop flex styles to prevent object recreation
  const desktopFlexStyle = useMemo(
    () => ({
      minWidth: TASK_LIST_MIN_WIDTH,
      width: '100%',
    }),
    []
  );

  const sidebarFlexStyle = useMemo(
    () => ({
      width: '100%',
      maxWidth: SIDEBAR_MAX_WIDTH,
    }),
    []
  );

  // Memoize components to prevent unnecessary re-renders
  const CreateProjectButtonComponent = useMemo(() => {
    if (!isOwnerOrAdmin) return null;

    return isDesktop ? (
      <div className="absolute right-0 top-1/2 -translate-y-1/2">
        <CreateProjectButton />
      </div>
    ) : (
      <CreateProjectButton />
    );
  }, [isDesktop, isOwnerOrAdmin]);

  return (
    <div className="my-8 min-h-[90vh]">
      <Col className="flex flex-col gap-6">
        <GreetingWithTime />
        {CreateProjectButtonComponent}
      </Col>

      <Row gutter={[24, 24]} className="mt-12">
        <Col xs={24} lg={16}>
          <Flex vertical gap={24}>
            <TasksList />
          </Flex>
        </Col>

        <Col xs={24} lg={8}>
          <Flex vertical gap={24}>
            <TodoList />
            
            <UserActivityFeed />

            <RecentAndFavouriteProjectList />
          </Flex>
        </Col>
      </Row>

      {createPortal(<TaskDrawer />, document.body, 'home-task-drawer')}
      {createPortal(<ProjectDrawer onClose={() => {}} />, document.body, 'project-drawer')}
      {createPortal(<SurveyPromptModal />, document.body, 'survey-modal')}
    </div>
  );
});

HomePage.displayName = 'HomePage';

export default HomePage;
