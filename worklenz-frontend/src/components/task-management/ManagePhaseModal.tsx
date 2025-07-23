import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Modal, Form, Input, Button, Space, Divider, Typography, Flex, ColorPicker, Tooltip } from '@/shared/antd-imports';
import { PlusOutlined, HolderOutlined, EditOutlined, DeleteOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  addPhaseOption,
  fetchPhasesByProjectId,
  updatePhaseOrder,
  updatePhaseListOrder,
  updateProjectPhaseLabel,
  updatePhaseName,
  deletePhaseOption,
  updatePhaseColor,
} from '@/features/projects/singleProject/phase/phases.slice';
import { updatePhaseLabel } from '@/features/project/project.slice';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import { Modal as AntModal } from '@/shared/antd-imports';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';
import { fetchEnhancedKanbanGroups } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { PhaseColorCodes } from '@/shared/constants';
import './ManagePhaseModal.css';

const { Title, Text } = Typography;

interface ManagePhaseModalProps {
  open: boolean;
  onClose: () => void;
  projectId?: string;
}

interface PhaseItemProps {
  phase: ITaskPhase;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
  isDarkMode: boolean;
}

// Sortable Phase Item Component (compact with hover actions)
const SortablePhaseItem: React.FC<PhaseItemProps & { id: string }> = ({
  id,
  phase,
  onRename,
  onDelete,
  onColorChange,
  isDarkMode,
}) => {
  const { t } = useTranslation('phases-drawer');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(phase.name || '');
  const [color, setColor] = useState(phase.color_code || PhaseColorCodes[0]);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<any>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = useCallback(() => {
    if (editName.trim() && editName.trim() !== phase.name) {
      onRename(id, editName.trim());
    }
    setIsEditing(false);
  }, [editName, id, onRename, phase.name]);

  const handleCancel = useCallback(() => {
    setEditName(phase.name || '');
    setIsEditing(false);
  }, [phase.name]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  const handleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleColorChangeComplete = useCallback(() => {
    if (color !== phase.color_code) {
      onColorChange(id, color);
    }
  }, [color, id, onColorChange, phase.color_code]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setColor(phase.color_code || PhaseColorCodes[0]);
  }, [phase.color_code]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative py-1.5 px-2 rounded border transition-all duration-200 ${
        isDarkMode
          ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500'
          : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
      } ${isDragging ? 'shadow-lg opacity-50 rotate-2 scale-105' : 'shadow-sm hover:shadow-md'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-2">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className={`flex-shrink-0 cursor-grab active:cursor-grabbing p-1 rounded transition-all duration-200 ${
            isDarkMode 
              ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-600' 
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}
        >
          <HolderOutlined className="text-sm" />
        </div>

        {/* Phase Color */}
        <div className="flex-shrink-0 flex items-center gap-1">
          <ColorPicker
            value={color}
            onChange={(value) => setColor(value.toHexString())}
            onChangeComplete={handleColorChangeComplete}
            size="small"
            className="phase-color-picker"
          />
          <div 
            className="w-2.5 h-2.5 rounded border shadow-sm"
            style={{
              backgroundColor: color,
              borderColor: isDarkMode ? '#6b7280' : '#d1d5db',
            }}
          />
        </div>

        {/* Phase Name */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <Input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className={`font-medium text-xs border-0 px-1 py-1 shadow-none ${
                isDarkMode 
                  ? 'bg-transparent text-gray-200 placeholder-gray-400' 
                  : 'bg-transparent text-gray-900 placeholder-gray-500'
              }`}
              placeholder={t('enterPhaseName')}
            />
          ) : (
            <Text
              className={`text-xs font-medium cursor-pointer transition-colors select-none ${
                isDarkMode ? 'text-gray-200 hover:text-gray-100' : 'text-gray-800 hover:text-gray-900'
              }`}
              onClick={handleClick}
              title={t('rename')}
            >
              {phase.name}
            </Text>
          )}
        </div>

        {/* Hover Actions */}
        <div className={`flex items-center gap-1 transition-all duration-200 ${
          isHovered || isEditing ? 'opacity-100' : 'opacity-0'
        }`}>
          <Tooltip title={t('rename')}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => setIsEditing(true)}
              className={`h-6 w-6 flex items-center justify-center transition-all duration-200 ${
                isDarkMode 
                  ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-600' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            />
          </Tooltip>
          <Tooltip title={t('delete')}>
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => onDelete(id)}
              className={`h-6 w-6 flex items-center justify-center transition-all duration-200 ${
                isDarkMode 
                  ? 'text-red-400 hover:text-red-300 hover:bg-red-800' 
                  : 'text-red-500 hover:text-red-600 hover:bg-red-50'
              }`}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

const ManagePhaseModal: React.FC<ManagePhaseModalProps> = ({
  open,
  onClose,
  projectId,
}) => {
  const { t } = useTranslation('phases-drawer');
  const dispatch = useAppDispatch();
  
  // Redux state
  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');
  const currentProjectId = useAppSelector(state => state.projectReducer.projectId);
  const { project } = useAppSelector(state => state.projectReducer);
  const { phaseList, loadingPhases } = useAppSelector(state => state.phaseReducer);
  
  const [phaseName, setPhaseName] = useState<string>(project?.phase_label || '');
  const [initialPhaseName, setInitialPhaseName] = useState<string>(project?.phase_label || '');
  const [sorting, setSorting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const finalProjectId = projectId || currentProjectId;

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (open && finalProjectId) {
      dispatch(fetchPhasesByProjectId(finalProjectId));
      setPhaseName(project?.phase_label || '');
      setInitialPhaseName(project?.phase_label || '');
    }
  }, [open, finalProjectId, project?.phase_label, dispatch]);

  const refreshTasks = useCallback(async () => {
    if (finalProjectId) {
      await dispatch(fetchTasksV3(finalProjectId));
      await dispatch(fetchEnhancedKanbanGroups(finalProjectId));
    }
  }, [finalProjectId, dispatch]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    if (!finalProjectId) return;
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = phaseList.findIndex(item => item.id === active.id);
      const newIndex = phaseList.findIndex(item => item.id === over.id);

      const newPhaseList = [...phaseList];
      const [movedItem] = newPhaseList.splice(oldIndex, 1);
      newPhaseList.splice(newIndex, 0, movedItem);

      try {
        setSorting(true);
        dispatch(updatePhaseListOrder(newPhaseList));

        const body = {
          from_index: oldIndex,
          to_index: newIndex,
          phases: newPhaseList,
          project_id: finalProjectId,
        };

        await dispatch(updatePhaseOrder({ projectId: finalProjectId, body })).unwrap();
        await refreshTasks();
      } catch (error) {
        dispatch(fetchPhasesByProjectId(finalProjectId));
        console.error('Error updating phase order', error);
      } finally {
        setSorting(false);
      }
    }
  }, [finalProjectId, phaseList, dispatch, refreshTasks]);

  const handleCreatePhase = useCallback(async () => {
    if (!newPhaseName.trim() || !finalProjectId) return;

    try {
      await dispatch(addPhaseOption({ projectId: finalProjectId, name: newPhaseName.trim() }));
      await dispatch(fetchPhasesByProjectId(finalProjectId));
      await refreshTasks();
      setNewPhaseName('');
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding phase:', error);
    }
  }, [finalProjectId, dispatch, refreshTasks, newPhaseName]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreatePhase();
    } else if (e.key === 'Escape') {
      setNewPhaseName('');
      setShowAddForm(false);
    }
  }, [handleCreatePhase]);

  const handleRenamePhase = useCallback(async (id: string, name: string) => {
    if (!finalProjectId) return;
    
    try {
      const phase = phaseList.find(p => p.id === id);
      if (!phase) return;

      const updatedPhase = { ...phase, name: name.trim() };
      const response = await dispatch(
        updatePhaseName({
          phaseId: id,
          phase: updatedPhase,
          projectId: finalProjectId,
        })
      ).unwrap();

      if (response.done) {
        dispatch(fetchPhasesByProjectId(finalProjectId));
        await refreshTasks();
      }
    } catch (error) {
      console.error('Error renaming phase:', error);
    }
  }, [finalProjectId, phaseList, dispatch, refreshTasks]);

  const handleDeletePhase = useCallback(async (id: string) => {
    if (!finalProjectId) return;
    
    AntModal.confirm({
      title: t('deletePhase'),
      content: t('deletePhaseConfirm'),
      okText: t('delete'),
      cancelText: t('cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const response = await dispatch(
            deletePhaseOption({ phaseOptionId: id, projectId: finalProjectId })
          ).unwrap();

          if (response.done) {
            dispatch(fetchPhasesByProjectId(finalProjectId));
            await refreshTasks();
          }
        } catch (error) {
          console.error('Error deleting phase:', error);
        }
      },
    });
  }, [finalProjectId, dispatch, refreshTasks, t]);

  const handleColorChange = useCallback(async (id: string, color: string) => {
    if (!finalProjectId) return;
    
    try {
      const phase = phaseList.find(p => p.id === id);
      if (!phase) return;

      const updatedPhase = { ...phase, color_code: color };
      const response = await dispatch(
        updatePhaseColor({ projectId: finalProjectId, body: updatedPhase })
      ).unwrap();

      if (response.done) {
        dispatch(fetchPhasesByProjectId(finalProjectId));
        await refreshTasks();
      }
    } catch (error) {
      console.error('Error changing phase color:', error);
    }
  }, [finalProjectId, phaseList, dispatch, refreshTasks]);

  const handlePhaseNameBlur = useCallback(async () => {
    if (!finalProjectId || phaseName === initialPhaseName) return;
    
    try {
      setIsSaving(true);
      const res = await dispatch(
        updateProjectPhaseLabel({ projectId: finalProjectId, phaseLabel: phaseName })
      ).unwrap();
      
      if (res.done) {
        dispatch(updatePhaseLabel(phaseName));
        setInitialPhaseName(phaseName);
        await refreshTasks();
      }
    } catch (error) {
      console.error('Error updating phase name:', error);
    } finally {
      setIsSaving(false);
    }
  }, [finalProjectId, phaseName, initialPhaseName, dispatch, refreshTasks]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Modal
      title={
        <Title level={4} className={`m-0 font-semibold ${
          isDarkMode ? 'text-gray-100' : 'text-gray-800'
        }`}>
          {t('configure')} {phaseName || project?.phase_label || t('phasesText')}
        </Title>
      }
      open={open}
      onCancel={handleClose}
      width={720}
      style={{ top: 20 }}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
          padding: '16px',
        },
      }}
      footer={
        <div className={`flex justify-end pt-3 ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <Button 
            onClick={handleClose}
            className={`font-medium ${
              isDarkMode 
                ? 'text-gray-300 hover:text-gray-200 border-gray-600' 
                : 'text-gray-600 hover:text-gray-800 border-gray-300'
            }`}
          >
            {t('close')}
          </Button>
        </div>
      }
      className={`${isDarkMode ? 'dark-modal' : ''} phase-manage-modal`}
      loading={loadingPhases || sorting}
    >
      <div className="space-y-4">
        {/* Phase Label Configuration */}
        <div className={`p-3 rounded border transition-all duration-200 ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700 text-gray-300' 
            : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          <div className="space-y-2">
            <Text className={`text-xs font-medium ${
              isDarkMode ? 'text-gray-300' : 'text-blue-700'
            }`}>
              {t('phaseLabel')}
            </Text>
            <Input
              placeholder={t('enterPhaseName')}
              value={phaseName}
              onChange={e => setPhaseName(e.currentTarget.value)}
              onPressEnter={handlePhaseNameBlur}
              onBlur={handlePhaseNameBlur}
              disabled={isSaving}
              size="small"
            />
          </div>
        </div>

        {/* Info Banner */}
        <div className={`p-3 rounded border transition-all duration-200 ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700 text-gray-300' 
            : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          <Text className={`text-xs font-medium ${
            isDarkMode ? 'text-gray-300' : 'text-blue-700'
          }`}>
            🎨 Drag {(phaseName || project?.phase_label || t('phasesText')).toLowerCase()} to reorder them. Click on a {(phaseName || project?.phase_label || t('phaseText')).toLowerCase()} name to rename it. Each {(phaseName || project?.phase_label || t('phaseText')).toLowerCase()} can have a custom color.
          </Text>
        </div>

        {/* Add New Phase Form */}
        {showAddForm && (
          <div className={`p-2 rounded border-2 border-dashed transition-all duration-200 ${
            isDarkMode 
              ? 'border-gray-600 bg-gray-700 hover:border-gray-500' 
              : 'border-gray-300 bg-white hover:border-gray-400'
          } shadow-sm`}>
            <div className="flex gap-2">
              <Input
                placeholder={t('enterNewPhaseName')}
                value={newPhaseName}
                onChange={(e) => setNewPhaseName(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`flex-1 ${
                  isDarkMode 
                    ? 'bg-gray-600 border-gray-500 text-gray-100 placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                size="small"
                autoFocus
              />
              <Button
                type="primary"
                onClick={handleCreatePhase}
                disabled={!newPhaseName.trim()}
                size="small"
                className="text-xs"
              >
                {t('create')}
              </Button>
              <Button
                onClick={() => {
                  setNewPhaseName('');
                  setShowAddForm(false);
                }}
                size="small"
                className={`text-xs ${
                  isDarkMode 
                    ? 'text-gray-300 hover:text-gray-200 border-gray-600' 
                    : 'text-gray-600 hover:text-gray-800 border-gray-300'
                }`}
              >
                {t('cancel')}
              </Button>
            </div>
          </div>
        )}

        {/* Add Phase Button */}
        {!showAddForm && (
          <div className={`p-3 rounded border-2 border-dashed transition-colors ${
            isDarkMode 
              ? 'border-gray-600 bg-gray-800/50 hover:border-gray-500' 
              : 'border-gray-300 bg-gray-50/50 hover:border-gray-400'
          }`}>
            <div className="flex items-center justify-between">
              <Text className={`text-xs font-medium ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {phaseName || project?.phase_label || t('phasesText')} {t('optionsText')}
              </Text>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={() => setShowAddForm(true)}
                disabled={loadingPhases}
                size="small"
                className="text-xs"
              >
                {t('addOption')}
              </Button>
            </div>
          </div>
        )}

        {/* Phase List with Drag & Drop */}
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext
            items={phaseList.map(phase => phase.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {phaseList.map((phase) => (
                <SortablePhaseItem
                  key={phase.id}
                  id={phase.id}
                  phase={phase}
                  onRename={handleRenamePhase}
                  onDelete={handleDeletePhase}
                  onColorChange={handleColorChange}
                  isDarkMode={isDarkMode}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {phaseList.length === 0 && (
          <div className={`text-center py-8 transition-colors ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <Text className="text-sm font-medium">
              {t('no')} {(phaseName || project?.phase_label || t('phasesText')).toLowerCase()} {t('found')}
            </Text>
            <br />
            <Button
              type="link"
              size="small"
              onClick={() => setShowAddForm(true)}
              className={`text-xs mt-1 font-medium ${
                isDarkMode 
                  ? 'text-blue-400 hover:text-blue-300' 
                  : 'text-blue-600 hover:text-blue-700'
              }`}
            >
              {t('addOption')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ManagePhaseModal; 