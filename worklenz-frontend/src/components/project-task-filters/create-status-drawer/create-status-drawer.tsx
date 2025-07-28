import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Flex from 'antd/es/flex';
import Badge from 'antd/es/badge';
import Drawer from 'antd/es/drawer';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import Select from 'antd/es/select';
import Button from 'antd/es/button/button';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleDrawer } from '@/features/projects/status/StatusSlice';

import './create-status-drawer.css';

import {
  createStatus,
  fetchStatusesCategories,
  fetchStatuses,
} from '@/features/taskAttributes/taskStatusSlice';
import { ITaskStatusCategory } from '@/types/status.types';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { evt_project_board_create_status } from '@/shared/worklenz-analytics-events';
import { fetchTaskGroups } from '@/features/tasks/tasks.slice';
import { fetchBoardTaskGroups } from '@/features/board/board-slice';

const StatusDrawer: React.FC = () => {
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { projectView } = useTabSearchParam();
  const [form] = Form.useForm();
  const { t } = useTranslation('task-list-filters');

  const isCreateStatusDrawerOpen = useAppSelector(
    state => state.statusReducer.isCreateStatusDrawerOpen
  );
  const { statusCategories } = useAppSelector(state => state.taskStatusReducer);
  const { projectId } = useAppSelector(state => state.projectReducer);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const refreshTasks = useCallback(() => {
    if (!projectId) return;
    const fetchAction = projectView === 'list' ? fetchTaskGroups : fetchBoardTaskGroups;
    dispatch(fetchAction(projectId));
  }, [projectId, projectView, dispatch]);

  const handleFormSubmit = async (values: { name: string; category: string }) => {
    if (!projectId) return;
    const body = {
      name: values.name,
      category_id: values.category,
      project_id: projectId,
    };
    const res = await dispatch(createStatus({ body, currentProjectId: projectId })).unwrap();
    if (res.done) {
      trackMixpanelEvent(evt_project_board_create_status);
      form.resetFields();
      dispatch(toggleDrawer());
      refreshTasks();
      dispatch(fetchStatusesCategories());
      // Refetch task statuses to ensure UI reflects the new status
      dispatch(fetchStatuses(projectId));
    }
  };

  const selectOptions = statusCategories.map((category: ITaskStatusCategory) => ({
    value: category.id,
    label: (
      <Flex gap={4}>
        <Badge color={category.color_code} /> {category.name}
      </Flex>
    ),
  }));

  const handleDrawerOpenChange = () => {
    if (statusCategories.length === 0) {
      dispatch(fetchStatusesCategories());
    }
  };

  return (
    <Drawer
      title={t('createStatus')}
      onClose={() => dispatch(toggleDrawer())}
      open={isCreateStatusDrawerOpen}
      afterOpenChange={handleDrawerOpenChange}
    >
      <Form layout="vertical" onFinish={handleFormSubmit} form={form}>
        <Form.Item
          name="name"
          label={t('name')}
          rules={[{ required: true, message: t('pleaseEnterAName') }]}
        >
          <Input type="text" placeholder={t('name')} />
        </Form.Item>

        <Form.Item
          name="category"
          label={t('category')}
          rules={[{ required: true, message: t('pleaseSelectACategory') }]}
        >
          <Select options={selectOptions} placeholder={t('selectCategory')} />
        </Form.Item>
        <Form.Item>
          <Button htmlType="submit" type="primary" style={{ width: '100%' }}>
            {t('create')}
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default StatusDrawer;
