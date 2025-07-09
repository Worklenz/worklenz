import { useEffect } from 'react';
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
import React from 'react';
import UserActivityFeed from './user-activity-feed/user-activity-feed';

const DESKTOP_MIN_WIDTH = 1024;
const TASK_LIST_MIN_WIDTH = 500;
const SIDEBAR_MAX_WIDTH = 400;
const TaskDrawer = React.lazy(() => import('@components/task-drawer/task-drawer'));

const HomePage = () => {
  const dispatch = useAppDispatch();
  const isDesktop = useMediaQuery({ query: `(min-width: ${DESKTOP_MIN_WIDTH}px)` });
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  useDocumentTitle('Home');

  useEffect(() => {
    const fetchLookups = async () => {
      const fetchPromises = [
        dispatch(fetchProjectHealth()),
        dispatch(fetchProjectCategories()),
        dispatch(fetchProjectStatuses()),
        dispatch(fetchProjects()),
      ].filter(Boolean);

      await Promise.all(fetchPromises);
    };
    fetchLookups();
  }, [dispatch]);

  const CreateProjectButtonComponent = () =>
    isDesktop ? (
      <div className="absolute right-0 top-1/2 -translate-y-1/2">
        {isOwnerOrAdmin && <CreateProjectButton />}
      </div>
    ) : (
      isOwnerOrAdmin && <CreateProjectButton />
    );

  return (
    <div className="my-24 min-h-[90vh]">
      <Col className="flex flex-col gap-6">
        <GreetingWithTime />
        <CreateProjectButtonComponent />
      </Col>

      <Row gutter={[24, 24]} className="mt-12">
        <Col xs={24} lg={16}>
          <Card title="Task List" className="h-full">
            <TasksList />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Flex vertical gap={24}>
            <UserActivityFeed />

            <TodoList />
            
            <Card title="Recent & Favorite Projects">
              <RecentAndFavouriteProjectList />
            </Card>
          </Flex>
        </Col>
      </Row>

      {createPortal(<TaskDrawer />, document.body, 'home-task-drawer')}
      {createPortal(<ProjectDrawer onClose={() => {}} />, document.body, 'project-drawer')}
    </div>
  );
};

export default HomePage;