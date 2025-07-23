import { Button, ColorPicker, ConfigProvider, Flex, Input } from '@/shared/antd-imports';
import { CloseCircleOutlined, HolderOutlined } from '@/shared/antd-imports';
import { nanoid } from '@reduxjs/toolkit';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  deletePhaseOption,
  fetchPhasesByProjectId,
  updatePhaseColor,
  updatePhaseName,
} from './phases.slice';
import { PhaseColorCodes } from '@/shared/constants';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import { TFunction } from 'i18next';
import logger from '@/utils/errorLogger';
import { useState, useEffect, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { fetchBoardTaskGroups } from '@/features/board/board-slice';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { fetchTaskGroups } from '@/features/tasks/tasks.slice';

interface PhaseOptionItemProps {
  option: ITaskPhase | null;
  projectId: string | null;
  t: TFunction;
}

const PhaseOptionItem = ({ option, projectId, t }: PhaseOptionItemProps) => {
  const [color, setColor] = useState(option?.color_code || PhaseColorCodes[0]);
  const [phaseName, setPhaseName] = useState(option?.name || '');
  const dispatch = useAppDispatch();
  const { projectView } = useTabSearchParam();

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: option?.id || 'temp-id',
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useEffect(() => {
    if (option) {
      setPhaseName(option.name);
      setColor(option.color_code);
    }
  }, [option]);

  const refreshTasks = useCallback(() => {
    if (!projectId) return;
    const fetchAction = projectView === 'list' ? fetchTaskGroups : fetchBoardTaskGroups;
    dispatch(fetchAction(projectId));
  }, [projectId, projectView, dispatch]);

  const handlePhaseNameChange = async (e: React.FocusEvent<HTMLInputElement>) => {
    if (!projectId || !option || phaseName.trim() === option.name.trim()) return;

    try {
      const updatedPhase = { ...option, name: phaseName.trim() };
      const response = await dispatch(
        updatePhaseName({
          phaseId: option.id,
          phase: updatedPhase,
          projectId,
        })
      ).unwrap();

      if (response.done) {
        dispatch(fetchPhasesByProjectId(projectId));
        refreshTasks();
      }
    } catch (error) {
      logger.error('Error updating phase name', error);
      setPhaseName(option.name);
    }
  };

  const handleDeletePhaseOption = async () => {
    if (!option?.id || !projectId) return;

    try {
      const response = await dispatch(
        deletePhaseOption({ phaseOptionId: option.id, projectId })
      ).unwrap();

      if (response.done) {
        dispatch(fetchPhasesByProjectId(projectId));
        refreshTasks();
      }
    } catch (error) {
      logger.error('Error deleting phase option', error);
    }
  };

  const handleColorChange = async () => {
    if (!projectId || !option) return;

    try {
      const updatedPhase = { ...option, color_code: color };
      const response = await dispatch(updatePhaseColor({ projectId, body: updatedPhase })).unwrap();

      if (response.done) {
        dispatch(fetchPhasesByProjectId(projectId));
        refreshTasks();
      }
    } catch (error) {
      logger.error('Error changing phase color', error);
    }
  };

  return (
    <ConfigProvider wave={{ disabled: true }}>
      <div ref={setNodeRef} style={style} {...attributes}>
        <Flex key={option?.id || nanoid()} align="center" gap={8}>
          <div {...listeners} style={{ cursor: 'grab' }}>
            <HolderOutlined />
          </div>
          <Input
            type="text"
            value={phaseName}
            onChange={e => setPhaseName(e.target.value)}
            onBlur={handlePhaseNameChange}
            onPressEnter={e => e.currentTarget.blur()}
            placeholder={t('enterPhaseName')}
          />
          <ColorPicker
            onChange={value => setColor(value.toHexString())}
            onChangeComplete={handleColorChange}
            value={color}
          />
          <Button
            className="borderless-icon-btn"
            icon={<CloseCircleOutlined />}
            onClick={handleDeletePhaseOption}
          />
        </Flex>
      </div>
    </ConfigProvider>
  );
};

export default PhaseOptionItem;
