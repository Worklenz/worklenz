import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Modal, Form, Input, Button, Space, Divider, Typography, Flex, ColorPicker } from 'antd';
import { PlusOutlined, HolderOutlined } from '@ant-design/icons';
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
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import { Modal as AntModal } from 'antd';
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

// Sortable Phase Item Component
const SortablePhaseItem: React.FC<PhaseItemProps & { id: string }> = ({
  id,
  phase,
  onRename,
  onDelete,
  onColorChange,
  isDarkMode,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(phase.name || '');
  const [color, setColor] = useState(phase.color_code || PhaseColorCodes[0]);
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
      className={`p-3 rounded-md border transition-all duration-200 ${
        isDarkMode
          ? 'bg-gray-800 border-gray-700 hover:bg-gray-750'
          : 'bg-white border-gray-200 hover:bg-gray-50 shadow-sm'
      }`}
    >
      {/* Header Row - Drag Handle, Phase Name, Actions */}
      <div className="flex items-center gap-2 mb-2">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className={`cursor-grab active:cursor-grabbing p-1 rounded transition-colors ${
            isDarkMode 
              ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700' 
              : 'text-gray-500 hover:text-gray-600 hover:bg-gray-100'
          }`}
        >
          <HolderOutlined />
        </div>

        {/* Phase Name */}
        <div className="flex-1">
          {isEditing ? (
            <Input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="font-medium"
              placeholder="Enter phase name"
            />
          ) : (
            <Text
              className={`text-sm font-medium cursor-pointer transition-colors ${
                isDarkMode ? 'text-gray-100 hover:text-white' : 'text-gray-900 hover:text-gray-700'
              }`}
              onClick={() => setIsEditing(true)}
            >
              {phase.name}
            </Text>
          )}
        </div>

        {/* Actions */}
        <Space size={4}>
          <Button
            type="text"
            size="small"
            onClick={() => setIsEditing(true)}
            className={`text-xs ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-600'} hover:bg-transparent`}
          >
            Rename
          </Button>
          <Button
            type="text"
            size="small"
            danger
            onClick={() => onDelete(id)}
            className="text-xs text-red-500 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Delete
          </Button>
        </Space>
      </div>

      {/* Color Row */}
      <div className="flex items-center gap-1.5">
        <Text 
          className={`text-xs font-medium ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          Color:
        </Text>
        <ColorPicker
          value={color}
          onChange={(value) => setColor(value.toHexString())}
          onChangeComplete={handleColorChangeComplete}
          size="small"
          className="phase-color-picker"
        />
        <div 
          className="w-3 h-3 rounded-full border ml-1 transition-all duration-200"
          style={{
            backgroundColor: color,
            borderColor: isDarkMode ? '#374151' : '#e5e7eb',
          }}
        />
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

  const handleAddPhase = useCallback(async () => {
    if (!finalProjectId) return;

    try {
      await dispatch(addPhaseOption({ projectId: finalProjectId }));
      await dispatch(fetchPhasesByProjectId(finalProjectId));
      await refreshTasks();
    } catch (error) {
      console.error('Error adding phase:', error);
    }
  }, [finalProjectId, dispatch, refreshTasks]);

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
      title: 'Delete Phase',
      content: 'Are you sure you want to delete this phase? This action cannot be undone.',
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
  }, [finalProjectId, dispatch, refreshTasks]);

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
        <Title level={4} className={isDarkMode ? 'text-gray-200' : 'text-gray-800'}>
          {t('configurePhases')}
        </Title>
      }
      open={open}
      onCancel={handleClose}
      width={600}
      style={{ top: 20 }}
      bodyStyle={{
        maxHeight: 'calc(100vh - 200px)',
        overflowY: 'auto',
        padding: '24px',
      }}
      footer={
        <Flex justify="flex-end">
          <Button onClick={handleClose}>
            Close
          </Button>
        </Flex>
      }
      className={isDarkMode ? 'dark-modal' : ''}
      loading={loadingPhases || sorting}
    >
      <div className="space-y-4">
        {/* Phase Label Configuration */}
        <div className={`p-3 rounded-md border ${
          isDarkMode 
            ? 'bg-gray-800/30 border-gray-700' 
            : 'bg-blue-50/50 border-blue-200'
        }`}>
          <div className="space-y-2">
            <Text className={`text-xs font-medium ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
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

        <Divider className={isDarkMode ? 'border-gray-700' : 'border-gray-300'} />

        {/* Phase Options */}
        <div className="space-y-4">
          <div className={`p-2.5 rounded-md ${
            isDarkMode ? 'bg-gray-800/50' : 'bg-purple-50'
          }`}>
            <Text 
              type="secondary" 
              className={`text-xs ${
                isDarkMode ? 'text-gray-400' : 'text-purple-600'
              }`}
            >
              🎨 Drag phases to reorder them. Each phase can have a custom color.
            </Text>
          </div>

          {/* Add New Phase */}
          <div className={`p-3 rounded-md border-2 border-dashed transition-colors ${
            isDarkMode 
              ? 'border-gray-600 bg-gray-800/50 hover:border-gray-500' 
              : 'border-gray-300 bg-gray-50/50 hover:border-gray-400'
          }`}>
            <div className="flex gap-2">
              <Text className={`text-xs font-medium flex-shrink-0 self-center ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {t('phaseOptions')}:
              </Text>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={handleAddPhase}
                disabled={loadingPhases}
                size="small"
                className="ml-auto"
              >
                {t('addOption')}
              </Button>
            </div>
          </div>

          {/* Phase List with Drag & Drop */}
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext
              items={phaseList.map(phase => phase.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
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
            <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <Text>No phases found. Add your first phase above.</Text>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ManagePhaseModal; 