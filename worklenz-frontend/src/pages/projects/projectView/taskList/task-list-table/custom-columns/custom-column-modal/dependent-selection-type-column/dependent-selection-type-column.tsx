import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { InputRef } from '@/shared/antd-imports';
import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Button,
  Collapse,
  Flex,
  Input,
  Select,
  Tag,
  Tooltip,
  Typography,
  theme,
} from '@/shared/antd-imports';
import { CloseCircleOutlined, WarningOutlined } from '@/shared/antd-imports';
import { PhaseColorCodes } from '@/shared/constants';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setSelectionsList } from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import { ITaskCustomColumn, ITaskCustomColumnSelectionOption } from '@/types/tasks/task.types';
import { getTaskCustomFieldDisplayName } from '@/utils/task-custom-columns';
import { SelectionType } from '../selection-type-column/selection-type-column';

/**
 * Option editor for a Selection field that depends on another Selection field: one collapsible
 * group per parent option, plus an "Unassigned" group for options whose parent option no longer
 * exists. Reads and writes the modal's `selectionsList` in the store.
 */
export const DependentSelectionTypeColumn = ({ parentColumn }: DependentSelectionTypeColumnProps) => {
  const { t } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const selections = useAppSelector(state => state.taskListCustomColumnsReducer.selectionsList);
  const inputRefs = useRef<Record<string, InputRef | null>>({});
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFocusId) return;
    inputRefs.current[pendingFocusId]?.focus();
    setPendingFocusId(null);
  }, [pendingFocusId, selections]);

  const parentName = parentColumn ? getTaskCustomFieldDisplayName(parentColumn) : '';
  const parentOptions = useMemo(
    () => parentColumn?.custom_column_obj?.selectionsList || [],
    [parentColumn]
  );
  const parentOptionIds = useMemo(
    () => new Set(parentOptions.map(option => option.selection_id)),
    [parentOptions]
  );
  const unassignedSelections = selections.filter(
    selection => !selection.parent_selection_id || !parentOptionIds.has(selection.parent_selection_id)
  );

  const colorOptions = useMemo(
    () =>
      PhaseColorCodes.map(color => ({
        value: color,
        label: (
          <Tag
            color={color}
            style={{ display: 'flex', alignItems: 'center', width: 15, height: 15, borderRadius: '50%' }}
          />
        ),
      })),
    []
  );

  const moveToOptions = parentOptions.map(option => ({
    value: option.selection_id,
    label: option.selection_name,
  }));

  const updateSelections = (nextSelections: SelectionType[]) => {
    dispatch(setSelectionsList(nextSelections));
  };

  const updateSelection = (selectionId: string, changes: Partial<SelectionType>) => {
    updateSelections(
      selections.map(selection =>
        selection.selection_id === selectionId ? { ...selection, ...changes } : selection
      )
    );
  };

  const handleAddSelection = (parentOption: ITaskCustomColumnSelectionOption) => {
    const selectionId = nanoid();
    updateSelections([
      ...selections,
      {
        selection_id: selectionId,
        selection_name: '',
        selection_color: parentOption.selection_color || PhaseColorCodes[0],
        parent_selection_id: parentOption.selection_id,
      },
    ]);
    setPendingFocusId(selectionId);
  };

  // Enter moves to the next option in the same group (adding one at the end) instead of
  // submitting the form.
  const handleSelectionEnter = (
    event: React.KeyboardEvent<HTMLInputElement>,
    selection: SelectionType,
    isUnassigned: boolean
  ) => {
    event.preventDefault();
    if (isUnassigned || !selection.selection_name.trim()) return;

    const parentOption = parentOptions.find(
      option => option.selection_id === selection.parent_selection_id
    );
    if (!parentOption) return;

    const groupSelections = selections.filter(
      item => item.parent_selection_id === parentOption.selection_id
    );
    const nextSelection =
      groupSelections[groupSelections.findIndex(item => item.selection_id === selection.selection_id) + 1];

    if (nextSelection) {
      setPendingFocusId(nextSelection.selection_id);
    } else {
      handleAddSelection(parentOption);
    }
  };

  const handleRemoveSelection = (selectionId: string) => {
    updateSelections(selections.filter(selection => selection.selection_id !== selectionId));
  };

  if (!parentColumn) {
    return (
      <Typography.Text type="secondary">
        {t('customColumns.dependentSelection.parentMissing', {
          defaultValue: 'The parent field could not be found. Choose another field in Type.',
        })}
      </Typography.Text>
    );
  }

  const renderSelectionRow = (selection: SelectionType, isUnassigned: boolean) => (
    <Flex gap={8} align="center" key={selection.selection_id}>
      <Input
        ref={element => {
          inputRefs.current[selection.selection_id] = element;
        }}
        value={selection.selection_name}
        onChange={event =>
          updateSelection(selection.selection_id, { selection_name: event.target.value })
        }
        onPressEnter={event => handleSelectionEnter(event, selection, isUnassigned)}
        placeholder={t('customColumns.dependentSelection.optionPlaceholder', {
          defaultValue: 'Type an option and press Enter',
        })}
        size="small"
        style={{ flex: 1, minWidth: 0 }}
        aria-label={t('customColumns.dependentSelection.optionNameLabel', {
          defaultValue: 'Option name',
        })}
      />
      <Select
        options={colorOptions}
        value={selection.selection_color}
        onChange={value => updateSelection(selection.selection_id, { selection_color: value })}
        size="small"
        style={{ width: 48 }}
        suffixIcon={null}
        aria-label={t('customColumns.dependentSelection.optionColorLabel', {
          defaultValue: 'Option color',
        })}
      />
      {isUnassigned && (
        <Select
          size="small"
          style={{ width: 128 }}
          placeholder={t('customColumns.dependentSelection.moveTo', { defaultValue: 'Move to…' })}
          options={moveToOptions}
          onChange={value => updateSelection(selection.selection_id, { parent_selection_id: value })}
          aria-label={t('customColumns.dependentSelection.moveToLabel', {
            defaultValue: 'Move option to another {{parent}} group',
            parent: parentName,
          })}
          popupMatchSelectWidth={false}
        />
      )}
      <Tooltip
        title={t('customColumns.dependentSelection.removeOption', { defaultValue: 'Remove option' })}
      >
        <Button
          type="text"
          size="small"
          icon={<CloseCircleOutlined />}
          onClick={() => handleRemoveSelection(selection.selection_id)}
          aria-label={t('customColumns.dependentSelection.removeOption', {
            defaultValue: 'Remove option',
          })}
        />
      </Tooltip>
    </Flex>
  );

  const groupItems = parentOptions.map(parentOption => {
    const groupSelections = selections.filter(
      selection => selection.parent_selection_id === parentOption.selection_id
    );

    return {
      key: parentOption.selection_id,
      label: (
        <Flex align="center" gap={8}>
          <Badge color={parentOption.selection_color} />
          <Typography.Text strong>{parentOption.selection_name}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('customColumns.dependentSelection.optionCount', {
              defaultValue: '{{count}} options',
              count: groupSelections.length,
            })}
          </Typography.Text>
        </Flex>
      ),
      children: (
        <Flex vertical gap={8}>
          {groupSelections.length === 0 && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('customColumns.dependentSelection.emptyGroup', {
                defaultValue: 'No options yet. Add the choices available when {{parent}} is {{value}}.',
                parent: parentName,
                value: parentOption.selection_name,
              })}
            </Typography.Text>
          )}
          {groupSelections.map(selection => renderSelectionRow(selection, false))}
          <Button
            type="link"
            size="small"
            onClick={() => handleAddSelection(parentOption)}
            style={{ width: 'fit-content', padding: 0 }}
          >
            {t('customColumns.dependentSelection.addOption', {
              defaultValue: '+ Add option under {{value}}',
              value: parentOption.selection_name,
            })}
          </Button>
        </Flex>
      ),
    };
  });

  return (
    <Flex vertical gap={8} style={{ maxWidth: '100%' }}>
      <Flex vertical gap={2}>
        <Typography.Text style={{ fontSize: 13, fontWeight: 500 }}>
          {t('customColumns.dependentSelection.title', {
            defaultValue: 'Options grouped by {{parent}}',
            parent: parentName,
          })}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('customColumns.dependentSelection.hint', {
            defaultValue:
              "On a task, only the options in the group matching the task's {{parent}} value can be picked.",
            parent: parentName,
          })}
        </Typography.Text>
      </Flex>

      <div style={{ maxHeight: 340, overflowY: 'auto' }}>
        {parentOptions.length === 0 ? (
          <Typography.Text type="secondary">
            {t('customColumns.dependentSelection.parentHasNoOptions', {
              defaultValue: '{{parent}} has no options yet. Add options to it first.',
              parent: parentName,
            })}
          </Typography.Text>
        ) : (
          <Collapse
            size="small"
            items={groupItems}
            defaultActiveKey={parentOptions.map(option => option.selection_id)}
          />
        )}

        {unassignedSelections.length > 0 && (
          <div
            role="group"
            aria-label={t('customColumns.dependentSelection.unassigned', {
              defaultValue: 'Unassigned',
            })}
            style={{
              marginTop: 8,
              padding: 12,
              borderRadius: token.borderRadiusLG,
              border: `1px solid ${token.colorWarningBorder}`,
              background: token.colorWarningBg,
            }}
          >
            <Flex vertical gap={8}>
              <Flex align="center" gap={6}>
                <WarningOutlined style={{ color: token.colorWarning }} />
                <Typography.Text strong>
                  {t('customColumns.dependentSelection.unassigned', { defaultValue: 'Unassigned' })}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {t('customColumns.dependentSelection.unassignedHint', {
                    defaultValue: 'Move each option to a {{parent}} group or remove it.',
                    parent: parentName,
                  })}
                </Typography.Text>
              </Flex>
              {unassignedSelections.map(selection => renderSelectionRow(selection, true))}
            </Flex>
          </div>
        )}
      </div>
    </Flex>
  );
};

interface DependentSelectionTypeColumnProps {
  parentColumn: ITaskCustomColumn | null;
}
