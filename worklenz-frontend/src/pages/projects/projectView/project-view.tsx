import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { PushpinFilled, PushpinOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Badge, Button, ConfigProvider, Flex, Tabs, TabsProps, Tooltip } from 'antd';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { getProject, setProjectId, setProjectView } from '@/features/project/project.slice';
import { fetchStatuses, resetStatuses } from '@/features/taskAttributes/taskStatusSlice';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { colors } from '@/styles/colors';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import ProjectViewHeader from './project-view-header';
import './project-view.css';
import { resetTaskListData } from '@/features/tasks/tasks.slice';
import { resetBoardData } from '@/features/board/board-slice';
import { fetchLabels } from '@/features/taskAttributes/taskLabelSlice';
import { deselectAll } from '@/features/projects/bulkActions/bulkActionSlice';
import { tabItems } from '@/lib/project/project-view-constants';
import { setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';

const DeleteStatusDrawer = React.lazy(() => import('@/components/project-task-filters/delete-status-drawer/delete-status-drawer'));
const PhaseDrawer = React.lazy(() => import('@features/projects/singleProject/phase/PhaseDrawer'));
const StatusDrawer = React.lazy(
  () => import('@/components/project-task-filters/create-status-drawer/create-status-drawer')
);
const ProjectMemberDrawer = React.lazy(
  () => import('@/components/projects/project-member-invite-drawer/project-member-invite-drawer')
);
const TaskDrawer = React.lazy(() => import('@components/task-drawer/task-drawer'));

const ProjectView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const { projectId } = useParams();

  const selectedProject = useAppSelector(state => state.projectReducer.project);
  useDocumentTitle(selectedProject?.name || 'Project View');
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('tab') || tabItems[0].key);
  const [pinnedTab, setPinnedTab] = useState<string>(searchParams.get('pinned_tab') || '');
  const [taskid, setTaskId] = useState<string>(searchParams.get('task') || '');

  const resetProjectData = useCallback(() => {
    dispatch(setProjectId(null));
    dispatch(resetStatuses());
    dispatch(deselectAll());
    dispatch(resetTaskListData());
    dispatch(resetBoardData());
  }, [dispatch]);

  useEffect(() => {
    if (projectId) {
      dispatch(setProjectId(projectId));
      dispatch(getProject(projectId)).then((res: any) => {
        if (!res.payload) {
          navigate('/worklenz/projects');
          return;
        }
        dispatch(fetchStatuses(projectId));
        dispatch(fetchLabels());
      });
    }
    if (taskid) {
      dispatch(setSelectedTaskId(taskid || ''));
      dispatch(setShowTaskDrawer(true));
    }

    return () => {
      resetProjectData();
    };
  }, [dispatch, navigate, projectId, taskid, resetProjectData]);

  const pinToDefaultTab = useCallback(async (itemKey: string) => {
    if (!itemKey || !projectId) return;

    const defaultView = itemKey === 'tasks-list' ? 'TASK_LIST' : 'BOARD';
    const res = await projectsApiService.updateDefaultTab({
      project_id: projectId,
      default_view: defaultView,
    });

    if (res.done) {
      setPinnedTab(itemKey);
      tabItems.forEach(item => {
        if (item.key === itemKey) {
          item.isPinned = true;
        } else {
          item.isPinned = false;
        }
      });

      navigate({
        pathname: `/worklenz/projects/${projectId}`,
        search: new URLSearchParams({
          tab: activeTab,
          pinned_tab: itemKey
        }).toString(),
      });
    }
  }, [projectId, activeTab, navigate]);

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
    dispatch(setProjectView(key === 'board' ? 'kanban' : 'list'));
    navigate({
      pathname: location.pathname,
      search: new URLSearchParams({
        tab: key,
        pinned_tab: pinnedTab,
      }).toString(),
    });
  }, [dispatch, location.pathname, navigate, pinnedTab]);

  const tabMenuItems = useMemo(() => tabItems.map(item => ({
    key: item.key,
    label: (
      <Flex align="center" style={{ color: colors.skyBlue }}>
        {item.label}
        {item.key === 'tasks-list' || item.key === 'board' ? (
          <ConfigProvider wave={{ disabled: true }}>
            <Button
              className="borderless-icon-btn"
              style={{
                backgroundColor: colors.transparent,
                boxShadow: 'none',
              }}
              icon={
                item.key === pinnedTab ? (
                  <PushpinFilled
                    size={20}
                    style={{
                      color: colors.skyBlue,
                      rotate: '-45deg',
                      transition: 'transform ease-in 300ms',
                    }}
                  />
                ) : (
                  <PushpinOutlined
                    size={20}
                    style={{
                      color: colors.skyBlue,
                    }}
                  />
                )
              }
              onClick={e => {
                e.stopPropagation();
                pinToDefaultTab(item.key);
              }}
            />
          </ConfigProvider>
        ) : null}
      </Flex>
    ),
    children: item.element,
  })), [pinnedTab, pinToDefaultTab]);

  const portalElements = useMemo(() => (
    <>
      {createPortal(<ProjectMemberDrawer />, document.body, 'project-member-drawer')}
      {createPortal(<PhaseDrawer />, document.body, 'phase-drawer')}
      {createPortal(<StatusDrawer />, document.body, 'status-drawer')}
      {createPortal(<TaskDrawer />, document.body, 'task-drawer')}
      {createPortal(<DeleteStatusDrawer />, document.body, 'delete-status-drawer')}
    </>
  ), []);

  return (
    <div style={{ marginBlockStart: 15, marginBlockEnd: 24, minHeight: '80vh' }}>
      <ProjectViewHeader />

      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabMenuItems}
        tabBarStyle={{ paddingInline: 0 }}
        destroyInactiveTabPane={true}
      />

      {portalElements}
    </div>
  );
};

export default React.memo(ProjectView);
