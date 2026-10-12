import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Modal, Input, Button, Typography, ColorPicker, Tooltip, Avatar, Checkbox, Spin, DatePicker, Tag, Switch, message, theme } from '@/shared/antd-imports';
import { PlusOutlined, HolderOutlined, EditOutlined, DeleteOutlined, UserOutlined, PlayCircleOutlined, CheckCircleOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createPortal } from 'react-dom';
import dayjs, { Dayjs } from 'dayjs';
import { useCreatePhaseMutation } from '@/pages/projects/projectView/gantt/services/roadmap-api.service';

import AvatarGroup from '@/components/AvatarGroup';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  addPhaseOption,
  addPhaseWithDates,
  fetchPhasesByProjectId,
  updatePhaseOrder,
  updatePhaseListOrder,
  updateProjectPhaseLabel,
  updatePhaseName,
  deletePhaseOption,
  updatePhaseColor,
  updatePhaseDefaultAssignee,
  updatePhaseDates,
} from '@/features/projects/singleProject/phase/phases.slice';
import { useSprintActions } from '@/hooks/useSprintActions';
import { mergeProject, updatePhaseLabel } from '@/features/project/project.slice';
import { phasesApiService } from '@/api/taskAttributes/phases/phases.api.service';
import { ITaskPhase, SprintStatus } from '@/types/tasks/taskPhase.types';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';
import { fetchEnhancedKanbanGroups } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { PhaseColorCodes } from '@/shared/constants';
import { IProjectMemberViewModel } from '@/types/projectMember.types';
import { getAllProjectMembers } from '@/features/projects/singleProject/members/projectMembersSlice';
import {
  getSoftwareProjectLabels,
  isSoftwareProjectType,
} from '@/lib/project/software-project';

const { Text } = Typography;

interface PhaseItemProps {
  phase: ITaskPhase;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
  onAssigneeChange: (id: string, assigneeId: string | null) => void;
  onDatesChange?: (id: string, startDate: Dayjs | null, endDate: Dayjs | null) => void;
  onStartSprint?: (id: string) => void;
  onCompleteSprint?: (id: string) => void;
  phaseAssigneesEnabled: boolean;
  isSoftware?: boolean;
  members: IProjectMemberViewModel[];
  disabled?: boolean;
}

const sprintStatusColor = (status?: SprintStatus): string => {
  if (status === 'active') return 'blue';
  if (status === 'completed') return 'green';
  return 'purple';
};

// Phase Assignee Dropdown with Phase Name Header (Portal-based like PhaseAssigneeSelector)
interface PhaseAssigneeDropdownProps {
  phase: ITaskPhase;
  members: IProjectMemberViewModel[];
  isOpen: boolean;
  onClose: () => void;
  onAssigneeSelect: (assigneeId: string | null) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
}

const PhaseAssigneeDropdown: React.FC<PhaseAssigneeDropdownProps> = ({
  phase,
  members,
  isOpen,
  onClose,
  onAssigneeSelect,
  triggerRef,
}) => {
  const { t } = useTranslation('phases-drawer');
  const { token } = theme.useToken();
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(phase.default_assignee_id || null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<any>(null);

  const filteredMembers = members.filter(member =>
    (member.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const updateDropdownPosition = useCallback(() => {
    const buttonElement = triggerRef?.current;
    if (buttonElement && dropdownRef.current) {
      const rect = buttonElement.getBoundingClientRect();
      const dropdownHeight = dropdownRef.current?.offsetHeight || 300;

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      const shouldOpenUpward = spaceBelow < dropdownHeight && spaceAbove >= dropdownHeight;

      if (shouldOpenUpward) {
        setDropdownPosition({
          top: Math.max(0, rect.top + window.scrollY - dropdownHeight),
          left: rect.left + window.scrollX,
        });
      } else {
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 2,
          left: rect.left + window.scrollX,
        });
      }
    }
  }, [triggerRef]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef?.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      requestAnimationFrame(() => {
        updateDropdownPosition();
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      });

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, updateDropdownPosition, onClose, triggerRef]);

  const handleMemberToggle = (memberId: string) => {
    // Toggle: if same member selected, deselect
    const newId = selectedAssigneeId === memberId ? null : memberId;
    setSelectedAssigneeId(newId);
    onAssigneeSelect(newId);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        zIndex: 99999,
        width: 288,
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        borderRadius: 8,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgElevated,
        boxShadow: token.boxShadowSecondary,
      }}
    >
      <div style={{ padding: 8, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        <Input
          ref={searchInputRef}
          size="small"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('searchMembers', { defaultValue: 'Search members...' })}
        />
      </div>

      <div style={{ maxHeight: 192, overflowY: 'auto' }}>
        {filteredMembers && filteredMembers.length > 0 ? (
          filteredMembers.map(member => (
            <div
              key={member.id || member.team_member_id}
              onClick={() => {
                if (!member.pending_invitation) {
                  handleMemberToggle(member.team_member_id || member.id || '');
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                cursor: member.pending_invitation ? 'not-allowed' : 'pointer',
                opacity: member.pending_invitation ? 0.5 : 1,
              }}
            >
              <Checkbox
                checked={selectedAssigneeId === (member.team_member_id || member.id)}
                disabled={member.pending_invitation}
                onChange={() => {
                  if (!member.pending_invitation) {
                    handleMemberToggle(member.team_member_id || member.id || '');
                  }
                }}
              />

              <Avatar
                size={24}
                src={member.avatar_url || undefined}
                icon={!member.avatar_url ? <UserOutlined /> : undefined}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{member.name}</div>
                <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
                  {member.email}
                  {member.pending_invitation && (
                    <span style={{ marginLeft: 4, color: token.colorError }}>
                      {t('pendingMemberLabel')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: 16, textAlign: 'center', color: token.colorTextSecondary }}>
            <Text style={{ fontSize: 12 }} type="secondary">
              {t('noMembersFound', { defaultValue: 'No members found' })}
            </Text>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

// Sortable Phase Item Component (compact with hover actions)
const SortablePhaseItem: React.FC<PhaseItemProps & { id: string }> = ({
  id,
  phase,
  onRename,
  onDelete,
  onColorChange,
  onAssigneeChange,
  onDatesChange,
  onStartSprint,
  onCompleteSprint,
  phaseAssigneesEnabled,
  isSoftware = false,
  members,
  disabled = false,
}) => {
  const { t } = useTranslation('phases-drawer');
  const { token } = theme.useToken();
  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(phase.name || '');
  const [color, setColor] = useState(phase.color_code || PhaseColorCodes[0]);
  const [isHovered, setIsHovered] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [isPhaseAssigneeDropdownOpen, setIsPhaseAssigneeDropdownOpen] = useState(false);
  const inputRef = useRef<any>(null);
  const assigneeButtonRef = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderRadius: 6,
    border: `1px solid ${isDragging ? token.colorPrimary : 'transparent'}`,
    background: isDragging ? token.colorFillSecondary : isHovered ? token.colorFillTertiary : 'transparent',
  };

  const handleSave = useCallback(() => {
    if (disabled) {
      setIsEditing(false);
      return;
    }
    if (editName.trim() && editName.trim() !== phase.name) {
      onRename(id, editName.trim());
    }
    setIsEditing(false);
  }, [editName, id, onRename, phase.name, disabled]);

  const handleCancel = useCallback(() => {
    setEditName(phase.name || '');
    setIsEditing(false);
  }, [phase.name]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        handleCancel();
      }
    },
    [handleSave, handleCancel]
  );

  const handleColorChangeComplete = useCallback(() => {
    if (disabled) return;
    setColorPickerOpen(false);
    if (color !== phase.color_code) {
      onColorChange(id, color);
    }
  }, [color, id, onColorChange, phase.color_code, disabled]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setColor(phase.color_code || PhaseColorCodes[0]);
  }, [phase.color_code]);

  // Get the default assignee member
  const defaultAssigneeMember = phase.default_assignee_id
    ? members.find(m => (m.team_member_id || m.id) === phase.default_assignee_id)
    : null;

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px' }}>
          <div
            {...(disabled ? {} : attributes)}
            {...(disabled ? {} : listeners)}
            style={{
              flexShrink: 0,
              display: 'flex',
              cursor: disabled ? 'not-allowed' : 'grab',
              color: token.colorTextTertiary,
            }}
            aria-disabled={disabled}
          >
            <HolderOutlined style={{ fontSize: 13 }} />
          </div>

          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <ColorPicker
              value={color}
              open={disabled ? false : colorPickerOpen}
              onOpenChange={open => {
                if (disabled) return;
                setColorPickerOpen(open);
              }}
              onChange={value => {
                if (disabled) return;
                setColor(value.toHexString());
              }}
              size="small"
              disabled={disabled}
              disabledAlpha
              panelRender={panel => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {panel}
                  <Button type="primary" size="small" block onClick={handleColorChangeComplete}>
                    {t('apply')}
                  </Button>
                </div>
              )}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  backgroundColor: color,
                  border: `1px solid ${token.colorBorderSecondary}`,
                }}
              />
            </ColorPicker>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {isEditing && !disabled ? (
              <Input
                ref={inputRef}
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                maxLength={50}
                size="small"
                variant="borderless"
                style={{ padding: 0, fontSize: 12, fontWeight: 500 }}
                placeholder={t('enterPhaseName')}
              />
            ) : (
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
                onClick={() => {
                  if (disabled) return;
                  setIsEditing(true);
                }}
                title={disabled ? undefined : t('rename')}
                ellipsis
              >
                {phase.name}
              </Text>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {isSoftware && (
              <Tag
                color={sprintStatusColor(phase.sprint_status)}
                style={{ margin: 0, textTransform: 'capitalize', fontSize: 11 }}
              >
                {phase.sprint_status || 'planned'}
              </Tag>
            )}

            {isSoftware && !disabled && phase.sprint_status === 'planned' && onStartSprint && (
              <Tooltip title={t('startSprint', { defaultValue: 'Start sprint' })}>
                <Button
                  type="primary"
                  size="small"
                  icon={<PlayCircleOutlined />}
                  onClick={() => onStartSprint(id)}
                  aria-label={t('startSprint', { defaultValue: 'Start sprint' })}
                >
                  {t('start', { defaultValue: 'Start' })}
                </Button>
              </Tooltip>
            )}

            {isSoftware &&
              !disabled &&
              phase.sprint_status === 'active' &&
              onCompleteSprint && (
                <Tooltip title={t('completeSprint', { defaultValue: 'Complete sprint' })}>
                  <Button
                    size="small"
                    icon={<CheckCircleOutlined />}
                    onClick={() => onCompleteSprint(id)}
                    aria-label={t('completeSprint', { defaultValue: 'Complete sprint' })}
                  >
                    {t('complete', { defaultValue: 'Complete' })}
                  </Button>
                </Tooltip>
              )}

            {phaseAssigneesEnabled && (
              <div ref={assigneeButtonRef} style={{ display: 'flex', alignItems: 'center' }}>
                {defaultAssigneeMember ? (
                  <button
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (disabled) return;
                      setIsPhaseAssigneeDropdownOpen(true);
                    }}
                    disabled={disabled}
                    title={t('manageAssignee', { defaultValue: 'Manage assignee' })}
                    aria-label={t('manageAssignee', { defaultValue: 'Manage assignee' })}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'none',
                      border: 'none',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      padding: 2,
                    }}
                  >
                    <AvatarGroup
                      members={[
                        {
                          id: defaultAssigneeMember.team_member_id || defaultAssigneeMember.id,
                          name: defaultAssigneeMember.name || '',
                          avatar_url: defaultAssigneeMember.avatar_url,
                        },
                      ]}
                      size={22}
                      maxCount={3}
                      isDarkMode={isDarkMode}
                    />
                  </button>
                ) : (
                  <button
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (disabled) return;
                      setIsPhaseAssigneeDropdownOpen(true);
                    }}
                    disabled={disabled}
                    title={t('assignMember', { defaultValue: 'Assign member' })}
                    aria-label={t('assignMember', { defaultValue: 'Assign member' })}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: `1px dashed ${token.colorBorder}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'none',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      color: token.colorTextSecondary,
                      flexShrink: 0,
                    }}
                  >
                    <PlusOutlined style={{ fontSize: 11 }} />
                  </button>
                )}
              </div>
            )}

            {!disabled && (
              <div style={{ display: 'flex', gap: 2, opacity: isHovered || isEditing ? 1 : 0 }}>
                <Tooltip title={t('rename')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined style={{ fontSize: 12 }} />}
                    onClick={() => setIsEditing(true)}
                    aria-label={t('rename')}
                  />
                </Tooltip>
                <Tooltip title={t('delete')}>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                    onClick={() => onDelete(id)}
                    aria-label={t('delete')}
                  />
                </Tooltip>
              </div>
            )}
          </div>
        </div>

        {isSoftware && onDatesChange && (
          <div style={{ padding: '0 8px 6px 49px' }}>
            <DatePicker.RangePicker
              size="small"
              variant="borderless"
              allowEmpty={[true, true]}
              disabled={disabled}
              value={[
                phase.start_date ? dayjs(phase.start_date) : null,
                phase.end_date ? dayjs(phase.end_date) : null,
              ]}
              onChange={dates => onDatesChange(id, dates?.[0] ?? null, dates?.[1] ?? null)}
              placeholder={[
                t('startDate', { defaultValue: 'Start date' }),
                t('endDate', { defaultValue: 'End date' }),
              ]}
              aria-label={t('sprintDates', { defaultValue: 'Sprint dates' })}
              style={{ padding: 0, fontSize: 11, maxWidth: 260 }}
            />
          </div>
        )}
      </div>

      {/* Phase Assignee Dropdown Portal */}
      {!disabled && (
        <PhaseAssigneeDropdown
          phase={phase}
          members={members}
          isOpen={isPhaseAssigneeDropdownOpen}
          onClose={() => setIsPhaseAssigneeDropdownOpen(false)}
          onAssigneeSelect={(assigneeId: string | null) => {
            onAssigneeChange(id, assigneeId);
          }}
          triggerRef={assigneeButtonRef}
        />
      )}
    </>
  );
};

interface ManagePhaseContentProps {
  projectId?: string;
  // Opt-in: adds Start/End Date fields to the "Add New Phase" form and creates
  // via the Roadmap's date-aware API instead of the classic date-less one.
  // Only Roadmap's Add Phase flow passes this — Project Settings and task
  // filter call sites are unaffected.
  enableDates?: boolean;
  disabled?: boolean;
}

/**
 * Inline (non-modal) phase management panel. Extracted from ManagePhaseModal
 * so it can be embedded directly inside the project settings modal's sidebar
 * as well as rendered inside a standalone Modal wrapper elsewhere.
 */
const ManagePhaseContent: React.FC<ManagePhaseContentProps> = ({
  projectId,
  enableDates = false,
  disabled = false,
}) => {
  const { t } = useTranslation('phases-drawer');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();

  // Redux state
  const currentProjectId = useAppSelector(state => state.projectReducer.projectId);
  const { project } = useAppSelector(state => state.projectReducer);
  const { phaseList, loadingPhases } = useAppSelector(state => state.phaseReducer);
  const { currentMembersList } = useAppSelector(state => state.projectMemberReducer);

  const [phaseName, setPhaseName] = useState<string>(project?.phase_label || '');
  const [initialPhaseName, setInitialPhaseName] = useState<string>(project?.phase_label || '');
  const [isSaving, setIsSaving] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [newPhaseStartDate, setNewPhaseStartDate] = useState<Dayjs | null>(null);
  const [newPhaseEndDate, setNewPhaseEndDate] = useState<Dayjs | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSavingAutoArchive, setIsSavingAutoArchive] = useState(false);
  const [createRoadmapPhase, { isLoading: isCreatingRoadmapPhase }] = useCreatePhaseMutation();

  const finalProjectId = projectId || currentProjectId;
  const sprintActions = useSprintActions(finalProjectId);
  const [modal, modalContextHolder] = Modal.useModal();
  const isSoftware = isSoftwareProjectType(project?.project_type);
  const softwareLabels = getSoftwareProjectLabels(project?.project_type);
  const showSprintFields = enableDates || isSoftware;

  // Whether phase assignees feature is enabled for this project
  const phaseAssigneesEnabled = Boolean(project?.phase_assignees_enabled);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (finalProjectId) {
      dispatch(fetchPhasesByProjectId(finalProjectId));
      // Ensure project members are loaded for the default assignee picker
      dispatch(getAllProjectMembers(finalProjectId));
      setPhaseName(project?.phase_label || '');
      setInitialPhaseName(project?.phase_label || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalProjectId, dispatch]);

  const refreshTasks = useCallback(async () => {
    if (finalProjectId) {
      await dispatch(fetchTasksV3(finalProjectId));
      await dispatch(fetchEnhancedKanbanGroups(finalProjectId));
    }
  }, [finalProjectId, dispatch]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      if (disabled) return;
      if (!finalProjectId) {
        console.warn('Cannot reorder phases: missing project ID');
        return;
      }

      const { active, over } = event;

      if (!over || !active || active.id === over.id) {
        return;
      }

      const oldIndex = phaseList.findIndex(item => item.id === active.id);
      const newIndex = phaseList.findIndex(item => item.id === over.id);

      // Validate indices
      if (oldIndex === -1 || newIndex === -1) {
        console.error('Cannot reorder phases: invalid drag indices', { oldIndex, newIndex, active: active.id, over: over.id });
        return;
      }

      const newPhaseList = [...phaseList];
      const [movedItem] = newPhaseList.splice(oldIndex, 1);
      newPhaseList.splice(newIndex, 0, movedItem);

      dispatch(updatePhaseListOrder(newPhaseList));

      const body = {
        from_index: oldIndex,
        to_index: newIndex,
        phases: newPhaseList,
        project_id: finalProjectId,
      };

      try {
        await dispatch(updatePhaseOrder({ projectId: finalProjectId, body })).unwrap();
        await refreshTasks();
      } catch (error) {
        dispatch(fetchPhasesByProjectId(finalProjectId));
        console.error('Error updating phase order', error);
      }
    },
    [finalProjectId, phaseList, dispatch, refreshTasks, disabled]
  );

  const handleCreatePhase = useCallback(async () => {
    if (disabled || !newPhaseName.trim() || !finalProjectId) return;

    try {
      if (enableDates) {
        await createRoadmapPhase({
          project_id: finalProjectId,
          name: newPhaseName.trim(),
          start_date: newPhaseStartDate ? newPhaseStartDate.toISOString() : undefined,
          end_date: newPhaseEndDate ? newPhaseEndDate.toISOString() : undefined,
        }).unwrap();
        await dispatch(fetchPhasesByProjectId(finalProjectId));
      } else if (isSoftware) {
        await dispatch(
          addPhaseWithDates({
            projectId: finalProjectId,
            name: newPhaseName.trim(),
            start_date: newPhaseStartDate ? newPhaseStartDate.toISOString() : null,
            end_date: newPhaseEndDate ? newPhaseEndDate.toISOString() : null,
          })
        ).unwrap();
      } else {
        await dispatch(addPhaseOption({ projectId: finalProjectId, name: newPhaseName.trim() }));
      }
      await refreshTasks();
      setNewPhaseName('');
      setNewPhaseStartDate(null);
      setNewPhaseEndDate(null);
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding phase:', error);
    }
  }, [
    finalProjectId,
    dispatch,
    refreshTasks,
    newPhaseName,
    disabled,
    enableDates,
    isSoftware,
    newPhaseStartDate,
    newPhaseEndDate,
    createRoadmapPhase,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleCreatePhase();
      } else if (e.key === 'Escape') {
        setNewPhaseName('');
        setNewPhaseStartDate(null);
        setNewPhaseEndDate(null);
        setShowAddForm(false);
      }
    },
    [handleCreatePhase]
  );

  const handleRenamePhase = useCallback(
    async (id: string, name: string) => {
      if (disabled || !finalProjectId) return;

      try {
        const phase = phaseList.find(p => p.id === id);
        if (!phase) return;

        const updatedPhase = { ...phase, name: name.trim() };
        await dispatch(
          updatePhaseName({
            phaseId: id,
            phase: updatedPhase,
            projectId: finalProjectId,
          })
        ).unwrap();
        // Slice patches the name in-place; no full re-fetch needed.
        await refreshTasks();
      } catch (error) {
        console.error('Error renaming phase:', error);
      }
    },
    [finalProjectId, phaseList, dispatch, refreshTasks, disabled]
  );

  const handleDeletePhase = useCallback(
    async (id: string) => {
      if (disabled || !finalProjectId) return;

      modal.confirm({
        title: t('deletePhase'),
        content: t('deletePhaseConfirm'),
        okText: t('delete'),
        cancelText: t('cancel'),
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await dispatch(
              deletePhaseOption({ phaseOptionId: id, projectId: finalProjectId })
            ).unwrap();
            // Slice removes the item in-place; no full re-fetch needed.
            await refreshTasks();
          } catch (error) {
            console.error('Error deleting phase:', error);
          }
        },
      });
    },
    [finalProjectId, dispatch, modal, refreshTasks, t, disabled]
  );

  const handleColorChange = useCallback(
    async (id: string, color: string) => {
      if (disabled || !finalProjectId) return;

      try {
        const phase = phaseList.find(p => p.id === id);
        if (!phase) return;

        const updatedPhase = { ...phase, color_code: color };
        await dispatch(
          updatePhaseColor({ projectId: finalProjectId, body: updatedPhase })
        ).unwrap();
        // Slice patches the color in-place; no full re-fetch needed.
        await refreshTasks();
      } catch (error) {
        console.error('Error changing phase color:', error);
      }
    },
    [finalProjectId, phaseList, dispatch, refreshTasks, disabled]
  );

  const handleAssigneeChange = useCallback(
    async (phaseId: string, assigneeId: string | null) => {
      if (disabled || !finalProjectId) return;

      try {
        await dispatch(
          updatePhaseDefaultAssignee({
            phaseId,
            projectId: finalProjectId,
            defaultAssigneeId: assigneeId,
          })
        ).unwrap();
      } catch (error) {
        console.error('Error updating default assignee:', error);
      }
    },
    [finalProjectId, dispatch, disabled]
  );

  const handleStartSprint = useCallback(
    (phaseId: string) => {
      if (disabled) return;
      void sprintActions.startSprint(phaseId);
    },
    [disabled, sprintActions]
  );

  const handleDatesChange = useCallback(
    async (phaseId: string, startDate: Dayjs | null, endDate: Dayjs | null) => {
      if (disabled || !finalProjectId) return;
      const phase = phaseList.find(p => p.id === phaseId);
      if (!phase) return;

      try {
        await dispatch(
          updatePhaseDates({
            phase,
            projectId: finalProjectId,
            start_date: startDate ? startDate.startOf('day').toISOString() : null,
            end_date: endDate ? endDate.endOf('day').toISOString() : null,
          })
        ).unwrap();
      } catch (error: unknown) {
        const errMsg =
          (error as { message?: string })?.message ||
          t('sprintDatesError', { defaultValue: 'Could not update sprint dates' });
        message.error(errMsg);
      }
    },
    [disabled, dispatch, finalProjectId, phaseList, t]
  );

  const handleCompleteSprint = useCallback(
    (phaseId: string) => {
      if (disabled) return;
      sprintActions.completeSprint(phaseId);
    },
    [disabled, sprintActions]
  );

  const handlePhaseNameBlur = useCallback(async () => {
    if (disabled || !finalProjectId || phaseName === initialPhaseName) return;

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
  }, [finalProjectId, phaseName, initialPhaseName, dispatch, refreshTasks, disabled]);

  const isAutoArchiveEnabled = project?.auto_archive_on_sprint_complete !== false;

  const handleAutoArchiveChange = useCallback(
    async (checked: boolean) => {
      if (disabled || !finalProjectId) return;

      setIsSavingAutoArchive(true);
      try {
        const res = await phasesApiService.updateSprintSettings(finalProjectId, checked);
        if (!res.done) throw new Error(res.message);
        dispatch(mergeProject({ auto_archive_on_sprint_complete: checked }));
      } catch (error) {
        console.error('Error updating sprint settings:', error);
        message.error(
          t('sprintSettingsError', { defaultValue: 'Could not update sprint settings' })
        );
      } finally {
        setIsSavingAutoArchive(false);
      }
    },
    [disabled, finalProjectId, dispatch, t]
  );

  const handleOpenAddForm = useCallback(() => {
    if (disabled) return;
    setShowAddForm(true);
  }, [disabled]);

  const phaseWord = (
    isSoftware
      ? softwareLabels.phasePlural
      : t('phasesText', { defaultValue: 'Phases' })
  ).toLowerCase();

  return (
    <Spin spinning={loadingPhases && phaseList.length === 0}>
      {sprintActions.sprintModalContextHolder}
      {modalContextHolder}
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        aria-disabled={disabled}
      >
        {/* Phase Label Configuration */}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorFillTertiary,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            {t('phaseLabel')}
          </Text>
          <Input
            placeholder={t('enterPhaseName')}
            value={phaseName}
            onChange={e => setPhaseName(e.currentTarget.value)}
            onPressEnter={handlePhaseNameBlur}
            onBlur={handlePhaseNameBlur}
            maxLength={50}
            showCount
            disabled={disabled || isSaving}
            size="small"
            style={{ cursor: disabled ? 'not-allowed' : undefined }}
          />
        </div>

        {isSoftware && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorFillTertiary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <Text
                id="auto-archive-sprint-label"
                style={{ fontSize: 12, fontWeight: 600, display: 'block' }}
              >
                {t('autoArchiveOnSprintComplete', {
                  defaultValue: 'Auto-archive done issues when a sprint completes',
                })}
              </Text>
              <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
                {t('autoArchiveOnSprintCompleteHint', {
                  defaultValue:
                    'Done issues in the completed sprint are archived automatically. Unfinished issues move to the destination you choose.',
                })}
              </Text>
            </div>
            <Switch
              size="small"
              checked={isAutoArchiveEnabled}
              loading={isSavingAutoArchive}
              disabled={disabled}
              onChange={handleAutoArchiveChange}
              aria-labelledby="auto-archive-sprint-label"
            />
          </div>
        )}

        {/* Phase Assignees info banner — only when feature is enabled */}
        {phaseAssigneesEnabled && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorFillTertiary,
            }}
          >
            <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
              {t('phaseAssigneesInfo', {
                defaultValue:
                  'Phase Assignees is enabled. Set a default assignee for each phase below — they will be auto-assigned when a task enters that phase.',
              })}
            </Text>
          </div>
        )}

        {/* Add New Phase Form / Button */}
        {showAddForm && !disabled ? (
          <div
            style={{
              padding: 8,
              borderRadius: 8,
              border: `1px dashed ${token.colorBorder}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <Input
                placeholder={t('enterNewPhaseName')}
                value={newPhaseName}
                onChange={e => setNewPhaseName(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={50}
                showCount
                size="small"
                autoFocus
                style={{ flex: 1 }}
              />
              <Button
                type="primary"
                onClick={handleCreatePhase}
                disabled={!newPhaseName.trim()}
                loading={enableDates && isCreatingRoadmapPhase}
                size="small"
              >
                {t('create')}
              </Button>
              <Button
                onClick={() => {
                  setNewPhaseName('');
                  setNewPhaseStartDate(null);
                  setNewPhaseEndDate(null);
                  setShowAddForm(false);
                }}
                size="small"
              >
                {t('cancel')}
              </Button>
            </div>

            {showSprintFields && (
              <div style={{ display: 'flex', gap: 6 }}>
                <DatePicker
                  placeholder={t('startDate', { defaultValue: 'Start date' })}
                  value={newPhaseStartDate}
                  onChange={date => setNewPhaseStartDate(date)}
                  disabledDate={current => !!newPhaseEndDate && !!current && current.isAfter(newPhaseEndDate, 'day')}
                  size="small"
                  style={{ flex: 1 }}
                />
                <DatePicker
                  placeholder={t('endDate', { defaultValue: 'End date' })}
                  value={newPhaseEndDate}
                  onChange={date => setNewPhaseEndDate(date)}
                  disabledDate={current => !!newPhaseStartDate && !!current && current.isBefore(newPhaseStartDate, 'day')}
                  size="small"
                  style={{ flex: 1 }}
                />
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px dashed ${token.colorBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
              {t('phasesText', { defaultValue: 'Phases' })} {t('optionsText')}
            </Text>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenAddForm}
              disabled={disabled || loadingPhases}
              size="small"
              aria-label={t('addOption')}
              style={{ cursor: disabled ? 'not-allowed' : undefined }}
            >
              {t('addOption')}
            </Button>
          </div>
        )}

        {/* Phase List with Drag & Drop */}
        <div
          style={{
            borderRadius: 10,
            border: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
            padding: 8,
          }}
        >
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext
              items={phaseList.map(phase => phase.id)}
              strategy={verticalListSortingStrategy}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {phaseList.map(phase => (
                  <SortablePhaseItem
                    key={phase.id}
                    id={phase.id}
                    phase={phase}
                    onRename={handleRenamePhase}
                    onDelete={handleDeletePhase}
                    onColorChange={handleColorChange}
                    onAssigneeChange={handleAssigneeChange}
                    onDatesChange={isSoftware ? handleDatesChange : undefined}
                    onStartSprint={isSoftware ? handleStartSprint : undefined}
                    onCompleteSprint={isSoftware ? handleCompleteSprint : undefined}
                    phaseAssigneesEnabled={phaseAssigneesEnabled}
                    isSoftware={isSoftware}
                    members={currentMembersList as IProjectMemberViewModel[]}
                    disabled={disabled}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {phaseList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Text style={{ fontSize: 12 }} type="secondary">
                {t('no')} {phaseWord} {t('found')}
              </Text>
              <br />
              <Button
                type="link"
                size="small"
                onClick={handleOpenAddForm}
                disabled={disabled}
                aria-label={t('addOption')}
                style={{ fontSize: 12, cursor: disabled ? 'not-allowed' : undefined }}
              >
                {t('addOption')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Spin>
  );
};

export default ManagePhaseContent;
