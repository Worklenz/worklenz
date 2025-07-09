import React, { useEffect, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Dropdown,
  Flex,
  Input,
  InputRef,
  Popconfirm,
  Tooltip,
  Typography,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  LoadingOutlined,
  MoreOutlined,
  PlusOutlined,
  RetweetOutlined,
} from '@ant-design/icons';
import { MenuProps } from 'antd';
import { useTranslation } from 'react-i18next';

import ChangeCategoryDropdown from '@/components/board/changeCategoryDropdown/ChangeCategoryDropdown';
import { useAppSelector } from '@/hooks/useAppSelector';
import { colors } from '@/styles/colors';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  deleteSection,
  IGroupBy,
  setBoardGroupName,
  setEditableSection,
} from '@features/board/board-slice';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { useAuthService } from '@/hooks/useAuth';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { phasesApiService } from '@/api/taskAttributes/phases/phases.api.service';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { evt_project_board_column_setting_click } from '@/shared/worklenz-analytics-events';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { statusApiService } from '@/api/taskAttributes/status/status.api.service';
import { fetchStatuses } from '@/features/taskAttributes/taskStatusSlice';
import { updateTaskGroupColor } from '@/features/tasks/tasks.slice';
import { ALPHA_CHANNEL } from '@/shared/constants';
import { ITaskStatusUpdateModel } from '@/types/tasks/task-status-update-model.types';
import { update } from 'lodash';
import logger from '@/utils/errorLogger';
import { toggleDrawer } from '@/features/projects/status/StatusSlice';
import {
  deleteStatusToggleDrawer,
  seletedStatusCategory,
} from '@/features/projects/status/DeleteStatusSlice';

interface BoardSectionCardHeaderProps {
  groupId: string;
  name: string;
  tasksCount: number;
  isLoading: boolean;
  setName: (newName: string) => void;
  colorCode: string;
  onHoverChange: (hovered: boolean) => void;
  setShowNewCard: (x: boolean) => void;
  categoryId: string | null;
}

const BoardSectionCardHeader: React.FC<BoardSectionCardHeaderProps> = ({
  groupId,
  name,
  tasksCount,
  isLoading,
  setName,
  colorCode,
  onHoverChange,
  setShowNewCard,
  categoryId = null,
}) => {
  const { trackMixpanelEvent } = useMixpanelTracking();
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const isProjectManager = useIsProjectManager();
  const [isEditable, setIsEditable] = useState(false);
  const [editName, setEdit] = useState(name);
  const [isEllipsisActive, setIsEllipsisActive] = useState(false);
  const inputRef = useRef<InputRef>(null);

  const { editableSectionId, groupBy } = useAppSelector(state => state.boardReducer);
  const { projectId } = useAppSelector(state => state.projectReducer);
  const { statusCategories, status } = useAppSelector(state => state.taskStatusReducer);

  const { t } = useTranslation('kanban-board');

  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const dispatch = useAppDispatch();

  useEffect(() => {
    if (isEditable && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditable]);

  useEffect(() => {
    if (editableSectionId === groupId && (isProjectManager || isOwnerOrAdmin)) {
      setIsEditable(true);
      dispatch(setEditableSection(null));
    }
  }, [editableSectionId, groupId, dispatch]);

  const getUniqueSectionName = (baseName: string): string => {
    // Check if the base name already exists
    const existingNames = status.map(status => status.name?.toLowerCase());

    if (!existingNames.includes(baseName.toLowerCase())) {
      return baseName;
    }

    // If the base name exists, add a number suffix
    let counter = 1;
    let newName = `${baseName.trim()} (${counter})`;

    while (existingNames.includes(newName.toLowerCase())) {
      counter++;
      newName = `${baseName.trim()} (${counter})`;
    }

    return newName;
  };

  const updateStatus = async (category = categoryId) => {
    if (!category || !projectId || !groupId) return;
    const sectionName = getUniqueSectionName(name);
    const body: ITaskStatusUpdateModel = {
      name: sectionName,
      project_id: projectId,
      category_id: category,
    };
    const res = await statusApiService.updateStatus(groupId, body, projectId);
    if (res.done) {
      dispatch(
        setBoardGroupName({
          groupId,
          name: sectionName ?? '',
          colorCode: res.body.color_code ?? '',
          colorCodeDark: res.body.color_code_dark ?? '',
          categoryId: category,
        })
      );
      dispatch(fetchStatuses(projectId));
      setName(sectionName);
    } else {
      setName(editName);
      logger.error('Error updating status', res.message);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const taskName = e.target.value;
    setName(taskName);
  };

  const handleBlur = async () => {
    if (name === 'Untitled section') {
      dispatch(deleteSection({ sectionId: groupId }));
    }
    setIsEditable(false);

    if (!projectId || !groupId) return;

    if (groupBy === IGroupBy.STATUS) {
      await updateStatus();
    }

    if (groupBy === IGroupBy.PHASE) {
      const body = {
        id: groupId,
        name: name,
      };

      const res = await phasesApiService.updateNameOfPhase(groupId, body as ITaskPhase, projectId);
      if (res.done) {
        trackMixpanelEvent(evt_project_board_column_setting_click, { Rename: 'Phase' });
        // dispatch(fetchPhasesByProjectId(projectId));
      }
    }
  };

  const handlePressEnter = () => {
    setShowNewCard(true);
    setIsEditable(false);
    handleBlur();
  };

  const handleDeleteSection = async () => {
    if (!projectId || !groupId) return;

    try {
      if (groupBy === IGroupBy.STATUS) {
        const replacingStatusId = '';
        const res = await statusApiService.deleteStatus(groupId, projectId, replacingStatusId);
        if (res.message === 'At least one status should exists under each category.') return;
        if (res.done) {
          dispatch(deleteSection({ sectionId: groupId }));
        } else {
          dispatch(
            seletedStatusCategory({
              id: groupId,
              name: name,
              category_id: categoryId ?? '',
              message: res.message ?? '',
            })
          );
          dispatch(deleteStatusToggleDrawer());
        }
      } else if (groupBy === IGroupBy.PHASE) {
        const res = await phasesApiService.deletePhaseOption(groupId, projectId);
        if (res.done) {
          dispatch(deleteSection({ sectionId: groupId }));
        }
      }
    } catch (error) {
      logger.error('Error deleting section', error);
    }
  };

  const items: MenuProps['items'] = [
    {
      key: '1',
      label: (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            width: '100%',
            gap: '8px',
          }}
          onClick={() => setIsEditable(true)}
        >
          <EditOutlined /> <span>{t('rename')}</span>
        </div>
      ),
    },
    groupBy === IGroupBy.STATUS && {
      key: '2',
      icon: <RetweetOutlined />,
      label: 'Change category',
      children: statusCategories?.map(status => ({
        key: status.id,
        label: (
          <Flex
            gap={8}
            onClick={() => status.id && updateStatus(status.id)}
            style={categoryId === status.id ? { fontWeight: 700 } : {}}
          >
            <Badge color={status.color_code} />
            {status.name}
          </Flex>
        ),
      })),
    },
    groupBy !== IGroupBy.PRIORITY && {
      key: '3',
      label: (
        <Popconfirm
          title={t('deleteConfirmationTitle')}
          icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
          okText={t('deleteConfirmationOk')}
          cancelText={t('deleteConfirmationCancel')}
          onConfirm={handleDeleteSection}
        >
          <Flex gap={8} align="center" style={{ width: '100%' }}>
            <DeleteOutlined />
            {t('delete')}
          </Flex>
        </Popconfirm>
      ),
    },
  ].filter(Boolean) as MenuProps['items'];

  return (
    <Flex
      align="center"
      justify="space-between"
      style={{
        fontWeight: 600,
        padding: '8px',
        backgroundColor: colorCode,
        borderRadius: 6,
      }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <Flex
        gap={8}
        align="center"
        style={{ cursor: 'pointer' }}
        onClick={() => {
          if ((isProjectManager || isOwnerOrAdmin) && name !== 'Unmapped') setIsEditable(true);
        }}
      >
        <Flex
          align="center"
          justify="center"
          style={{
            minWidth: 26,
            height: 26,
            borderRadius: 120,
            backgroundColor: themeWiseColor('white', '#1e1e1e', themeMode),
          }}
        >
          {tasksCount}
        </Flex>

        {isLoading && <LoadingOutlined style={{ color: colors.darkGray }} />}
        {isEditable ? (
          <Input
            ref={inputRef}
            value={name}
            variant="borderless"
            style={{
              backgroundColor: themeWiseColor('white', '#1e1e1e', themeMode),
            }}
            onChange={handleChange}
            onBlur={handleBlur}
            onPressEnter={handlePressEnter}
          />
        ) : (
          <Tooltip title={isEllipsisActive ? name : null}>
            <Typography.Text
              ellipsis={{
                tooltip: false,
                onEllipsis: ellipsed => setIsEllipsisActive(ellipsed),
              }}
              style={{
                minWidth: 200,
                textTransform: 'capitalize',
                color: themeMode === 'dark' ? '#383838' : '',
                display: 'inline-block',
                overflow: 'hidden',
              }}
            >
              {name}
            </Typography.Text>
          </Tooltip>
        )}
      </Flex>

      <div style={{ display: 'flex' }}>
        <Button
          type="text"
          size="small"
          shape="circle"
          style={{ color: themeMode === 'dark' ? '#383838' : '' }}
          onClick={() => setShowNewCard(true)}
        >
          <PlusOutlined />
        </Button>

        {(isOwnerOrAdmin || isProjectManager) && name !== 'Unmapped' && (
          <Dropdown
            overlayClassName="todo-threedot-dropdown"
            trigger={['click']}
            menu={{ items }}
            placement="bottomLeft"
          >
            <Button type="text" size="small" shape="circle">
              <MoreOutlined
                style={{
                  rotate: '90deg',
                  fontSize: '25px',
                  color: themeMode === 'dark' ? '#383838' : '',
                }}
              />
            </Button>
          </Dropdown>
        )}
      </div>
    </Flex>
  );
};

export default BoardSectionCardHeader;
