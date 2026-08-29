import { useEffect, memo, useMemo, useCallback } from 'react';
import { useMediaQuery } from 'react-responsive';
import Col from 'antd/es/col';
import Flex from 'antd/es/flex';

import GreetingWithTime from './greeting-with-time';
import TasksList from '@/pages/home/task-list/tasks-list';
import TodoList from '@/pages/home/todo-list/todo-list';
import { ProjectSettingsModal } from '@/components/projects/project-settings-modal/project-settings-modal';
import CreateProjectButton from '@/components/projects/project-create-button/project-create-button';
import RecentAndFavouriteProjectList from '@/pages/home/recent-and-favourite-project-list/recent-and-favourite-project-list';

import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAuthService } from '@/hooks/useAuth';

import { fetchProjectStatuses } from '@/features/projects/lookups/projectStatuses/projectStatusesSlice';
import { fetchProjectCategories } from '@/features/projects/lookups/projectCategories/projectCategoriesSlice';
import { fetchProjectHealth } from '@/features/projects/lookups/projectHealth/projectHealthSlice';
import { fetchProjects } from '@/features/home-page/home-page.slice';
import { createPortal } from 'react-dom';
import React, { Suspense } from 'react';

const DESKTOP_MIN_WIDTH = 1024;
const TASK_LIST_MIN_WIDTH = 500;
const SIDEBAR_MAX_WIDTH = 400;

// Lazy load heavy components
const TaskDrawer = React.lazy(() => import('@/components/task-drawer/task-drawer'));

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

  const MainContent = useMemo(() => {
    return isDesktop ? (
      <Flex vertical gap={24} align="stretch" style={{ minHeight: 0, height: '100%', width: '100%' }}>
        <Flex gap={24} align="flex-start" style={{ minHeight: 0, flex: 1, width: '100%' }}>
          <Flex style={{ ...desktopFlexStyle, width: '100%', minHeight: 0, flex: 1 }}>
            <TasksList />
          </Flex>
          <Flex vertical gap={24} style={{ ...sidebarFlexStyle, minHeight: 0, flex: 1 }}>
            <RecentAndFavouriteProjectList />
          </Flex>
        </Flex>
        <div style={{ flex: 1, minHeight: 0, height: '100%' }}>
          <TodoList />
        </div>
      </Flex>
    ) : (
      <Flex vertical gap={24} className="mt-6" style={{ flex: 1, height: '100%' }}>
        <TasksList />
        <div style={{ flex: 1, minHeight: 0, height: '100%' }}>
          <TodoList />
        </div>
        <RecentAndFavouriteProjectList />
      </Flex>
    );
  }, [isDesktop, desktopFlexStyle, sidebarFlexStyle]);

  return (
    <div className="min-h-screen flex flex-col">
      <Col className="flex flex-col gap-6 pt-6 pb-6">
        <GreetingWithTime />
        {CreateProjectButtonComponent}
      </Col>

      <div className="flex-1">
        {MainContent}
      </div>

      {/* Use Suspense for lazy-loaded components with error boundary */}
      <Suspense fallback={<div>Loading...</div>}>
        {createPortal(
          <React.Suspense fallback={null}>
            <TaskDrawer />
          </React.Suspense>,
          document.body,
          'home-task-drawer'
        )}
      </Suspense>

      {createPortal(
        <ProjectSettingsModal onClose={handleProjectDrawerClose} />,
        document.body,
        'project-settings-modal'
      )}
    </div>
  );
});

HomePage.displayName = 'HomePage';

export default HomePage;
