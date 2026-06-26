import React, { useCallback, useEffect, useState } from 'react';
import {
  Drawer,
  Alert,
  Card,
  Select,
  Button,
  Typography,
  Badge,
  Form,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchStatuses, fetchStatusesCategories } from '@/features/taskAttributes/taskStatusSlice';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { fetchTaskGroups } from '@/features/tasks/tasks.slice';

import { deleteStatusToggleDrawer } from '@/features/projects/status/DeleteStatusSlice';
import { DownOutlined } from '@/shared/antd-imports';
import { deleteSection, IGroupBy } from '@features/enhanced-kanban/enhanced-kanban.slice';
import { statusApiService } from '@/api/taskAttributes/status/status.api.service';
import { phasesApiService } from '@/api/taskAttributes/phases/phases.api.service';
import logger from '@/utils/errorLogger';
import { fetchEnhancedKanbanGroups } from '@/features/enhanced-kanban/enhanced-kanban.slice';
const { Title, Text } = Typography;

const DeleteStatusDrawer: React.FC = () => {
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [deletingStatus, setDeletingStatus] = useState(false);
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { projectView } = useTabSearchParam();
  const [form] = Form.useForm();
  const { t } = useTranslation('task-list-filters');
  const { editableSectionId, groupBy } = useAppSelector(state => state.enhancedKanbanReducer);
  const isDelteStatusDrawerOpen = useAppSelector(
    state => state.deleteStatusReducer.isDeleteStatusDrawerOpen
  );
  const { isDeleteStatusDrawerOpen, status: selectedForDelete } = useAppSelector(
    state => state.deleteStatusReducer
  );
  const { status, statusCategories } = useAppSelector(state => state.taskStatusReducer);
  const { projectId } = useAppSelector(state => state.projectReducer);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const refreshTasks = useCallback(() => {
    if (!projectId) return;
    const fetchAction = projectView === 'list' ? fetchTaskGroups : fetchEnhancedKanbanGroups;
    dispatch(fetchAction(projectId) as any);
  }, [projectId, projectView, dispatch]);

  const handleDrawerOpenChange = () => {
    if (status.length === 0) {
      dispatch(fetchStatusesCategories());
    }
  };

  const setReplacingStatus = (value: string) => {
    setCurrentStatus(value);
  };
  const moveAndDelete = async () => {
    const groupId = selectedForDelete?.id;
    if (!projectId || !currentStatus || !groupId) return;
    setDeletingStatus(true);
    try {
      if (groupBy === IGroupBy.STATUS) {
        const replacingStatusId = currentStatus;
        if (!replacingStatusId) return;
        const res = await statusApiService.deleteStatus(groupId, projectId, replacingStatusId);
        if (res.done) {
          dispatch(deleteSection({ sectionId: groupId }));
          dispatch(deleteStatusToggleDrawer());
          dispatch(fetchStatuses(projectId));
          refreshTasks();
          dispatch(fetchStatusesCategories());
        } else {
          console.error('Error deleting status', res);
        }
      } else if (groupBy === IGroupBy.PHASE) {
        const res = await phasesApiService.deletePhaseOption(groupId, projectId);
        if (res.done) {
          dispatch(deleteSection({ sectionId: groupId }));
        }
      }
    } catch (error) {
      logger.error('Error deleting section', error);
    } finally {
      setDeletingStatus(false);
    }
  };
  useEffect(() => {
    setCurrentStatus(status[0]?.id || '');
  }, [isDelteStatusDrawerOpen]);

  return (
    <Drawer
      title="You are deleting a status"
      onClose={() => dispatch(deleteStatusToggleDrawer())}
      open={isDelteStatusDrawerOpen}
      afterOpenChange={handleDrawerOpenChange}
    >
      <Alert type="warning" message={selectedForDelete?.message.replace('$', '')} />

      <Card className="text-center" style={{ marginTop: 16 }}>
        <Title level={5}>{selectedForDelete?.name}</Title>
        <Title level={4} style={{ margin: '16px 0' }}>
          <DownOutlined />
        </Title>

        <Select
          value={currentStatus}
          onChange={setReplacingStatus}
          style={{ width: '100%' }}
          optionLabelProp="name"
          options={status.map(item => ({
            key: item.id,
            value: item.id,
            name: item.name,
            label: (
              <Badge
                color={item.color_code}
                text={item?.name || null}
                style={{
                  opacity: item.id === selectedForDelete?.id ? 0.5 : undefined,
                }}
              />
            ),
            disabled: item.id === selectedForDelete?.id,
          }))}
        />

        <Button
          type="primary"
          block
          loading={deletingStatus}
          disabled={deletingStatus}
          onClick={moveAndDelete}
          style={{ marginTop: 16 }}
        >
          Done
        </Button>
      </Card>
    </Drawer>
  );
};

export default DeleteStatusDrawer;
