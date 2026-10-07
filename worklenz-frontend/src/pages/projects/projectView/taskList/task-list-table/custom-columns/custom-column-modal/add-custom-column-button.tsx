import { PlusOutlined, CrownOutlined } from '@/shared/antd-imports';
import { Button, Tooltip, message } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess, isFreeUser } from '@/utils/subscription-utils';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { LICENSING_SETTINGS } from '@/shared/licensing_settings';
import { nanoid } from '@reduxjs/toolkit';
import { CustomTableColumnsType } from '@/features/projects/singleProject/taskListColumns/taskColumnsSlice';
import { addCustomColumn } from '@/features/task-management/task-management.slice';
import { useParams } from 'react-router-dom';
import { tasksCustomColumnsService } from '@/api/tasks/tasks-custom-columns.service';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import logger from '@/utils/errorLogger';
import { useState } from 'react';

const AddCustomColumnButton = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('common');
  const { projectId } = useParams();
  const { socket } = useSocket();
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const isFree = isFreeUser(currentSession);
  const hasBusinessAccess = hasBusinessFeatureAccess(currentSession);
  const columnList = useAppSelector(state => state.projectViewTaskListColumnsReducer.columnList);
  const customColumnsCount = columnList.filter(column => column.custom_column).length;
  const hasReachedCustomFieldLimit = !hasBusinessAccess && customColumnsCount >= LICENSING_SETTINGS.CUSTOM_FIELDS_LIMIT;
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateColumn = async () => {
    if (isFree || hasReachedCustomFieldLimit) {
      dispatch(toggleUpgradeModal());
      return;
    }

    if (isCreating) return;
    setIsCreating(true);

    try {
      const columnKey = nanoid();
      const defaultFieldTitle = t('newColumn', { defaultValue: 'New Column' });

      const configuration = {
        field_title: defaultFieldTitle,
        field_type: 'text',
        number_type: undefined,
        decimals: undefined,
        label: undefined,
        label_position: undefined,
        preview_value: undefined,
        expression: undefined,
        first_numeric_column_key: undefined,
        second_numeric_column_key: undefined,
        selections_list: [],
        labels_list: [],
      };

      // Create column in backend
      const res = await tasksCustomColumnsService.createCustomColumn(projectId || '', {
        name: defaultFieldTitle,
        key: columnKey,
        field_type: 'text',
        width: 120,
        is_visible: true,
        configuration,
      });

      if (res.done) {
        const newColumn: CustomTableColumnsType = {
          key: columnKey,
          name: defaultFieldTitle,
          columnHeader: null, // Will be rendered dynamically
          width: 120,
          isVisible: true,
          custom_column: true,
          custom_column_obj: {
            fieldTitle: defaultFieldTitle,
            fieldType: 'text',
            labelsList: [],
            selectionsList: [],
          },
          id: res.body.id,
          uuid: res.body.id,
          pinned: true, // Make column visible by default
          isEditingHeader: true, // Flag to trigger inline editing
        };

        dispatch(addCustomColumn(newColumn));
        socket?.emit(SocketEvents.CUSTOM_COLUMN_CREATED.toString(), JSON.stringify({ project_id: projectId }));
        
        message.success(t('columnCreated', { defaultValue: 'Column created. Click on the header to edit.' }));
      }
    } catch (error) {
      logger.error('Error creating custom column:', error);
      message.error(t('columnCreationFailed', { defaultValue: 'Failed to create column' }));
    } finally {
      setIsCreating(false);
    }
  };

  const tooltipTitle = hasReachedCustomFieldLimit
    ? t('customFieldLimitReached', { defaultValue: 'Custom field limit reached. Upgrade to add more.' })
    : isFree
      ? t('upgrade-plan', { defaultValue: 'Upgrade plan' })
      : t('addCustomColumn', { defaultValue: 'Add a custom column' });

  return (
    <>
      <Tooltip title={tooltipTitle}>
        <Button
          icon={isFree ? <CrownOutlined style={{ color: '#faad14' }} /> : <PlusOutlined />}
          style={{
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
          }}
          onClick={handleCreateColumn}
          loading={isCreating}
          disabled={isCreating}
        />
      </Tooltip>
    </>
  );
};

export default AddCustomColumnButton;
