import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Flex from 'antd/es/flex';
import Badge from 'antd/es/badge';
import Drawer from 'antd/es/drawer';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import Select from 'antd/es/select';
import Button from 'antd/es/button/button';

import { useAppSelector } from '@/hooks/use-app-selector';
import { useAppDispatch } from '@/hooks/use-app-dispatch';
import { toggleDrawer } from '@/features/projects/status/StatusSlice';

import './create-status-drawer.css';

import { createStatus, fetchStatusesCategories } from '@/features/task-attributes/task-status.slice';
import { ITaskStatusCategory } from '@/types/status.types';
import { useMixpanelTracking } from '@/hooks/use-mixpanel-tracking';
import useTabSearchParam from '@/hooks/useTabSearchParam';
;
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
