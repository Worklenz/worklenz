import React, { useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Button,
  Flex,
  Input,
  Select,
  Tooltip,
  Typography,
  theme,
} from '@/shared/antd-imports';
import type { InputRef } from '@/shared/antd-imports';
import { CloseCircleOutlined, WarningOutlined } from '@/shared/antd-imports';
import { PhaseColorCodes } from '@/shared/constants';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setSelectionsList } from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import { ITaskCustomColumn, ITaskCustomColumnSelectionOption } from '@/types/tasks/task.types';
import { getTaskCustomFieldDisplayName } from '@/utils/task-custom-columns';
import { SelectionType } from '../selection-type-column/selection-type-column';
import SelectionColorPicker from '../SelectionColorPicker';

const splitOptionLabels = (raw: string) =>
  raw
    .split(',')
    .map(label => label.trim())
    .filter(Boolean);

const addInputFocusId = (parentOptionId: string) => `__add_${parentOptionId}__`;

/**
 * Option editor for Dependent Selection: one group per parent option, plus Unassigned
 * for options whose parent option no longer exists. Reads/writes modal `selectionsList`.
 */
export const DependentSelectionTypeColumn = ({ parentColumn }: DependentSelectionTypeColumnProps) => {
  const { t } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const selections = useAppSelector(state => state.taskListCustomColumnsReducer.selectionsList);
  const [draftByParentId, setDraftByParentId] = useState<Record<string, string>>({});
  const inputRefs = useRef<Record<string, InputRef | null>>({});
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFocusId) return;
    inputRefs.current[pendingFocusId]?.focus();
    setPendingFocusId(null);
  }, [pendingFocusId, selections, draftByParentId]);

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
    selection =>
      !selection.parent_selection_id || !parentOptionIds.has(selection.parent_selection_id)
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

  const handleAddSelections = (parentOption: ITaskCustomColumnSelectionOption, rawValue: string) => {
    const labels = splitOptionLabels(rawValue);
    if (!labels.length) return;

    const nextSelections = [...selections];
    labels.forEach((label, index) => {
      nextSelections.push({
        selection_id: nanoid(),
        selection_name: label,
        selection_color:
          parentOption.selection_color ||
          PhaseColorCodes[(selections.length + index) % PhaseColorCodes.length],
        parent_selection_id: parentOption.selection_id,
      });
    });
    updateSelections(nextSelections);
    setDraftByParentId(prev => ({ ...prev, [parentOption.selection_id]: '' }));
    setPendingFocusId(addInputFocusId(parentOption.selection_id));
  };

  const handleRemoveSelection = (selectionId: string) => {
    updateSelections(selections.filter(selection => selection.selection_id !== selectionId));
  };

  const handleGroupSelectionEnter = (
    event: React.KeyboardEvent<HTMLInputElement>,
    parentOption: ITaskCustomColumnSelectionOption,
    selection: SelectionType
  ) => {
    event.preventDefault();
    if (!selection.selection_name.trim()) return;

    const groupSelections = selections.filter(
      item => item.parent_selection_id === parentOption.selection_id
    );
    const currentIndex = groupSelections.findIndex(
      item => item.selection_id === selection.selection_id
    );
    const nextSelection = groupSelections[currentIndex + 1];

    if (nextSelection) {
      setPendingFocusId(nextSelection.selection_id);
    } else {
      setPendingFocusId(addInputFocusId(parentOption.selection_id));
    }
  };

  if (!parentColumn) {
    return (
      <Typography.Text type="secondary">
        {t('customColumns.dependentSelection.parentMissing', {
          defaultValue: 'The parent column could not be found. Choose another column in Type.',
        })}
      </Typography.Text>
    );
  }

  const renderSelectionRow = (
    selection: SelectionType,
    isUnassigned: boolean,
    parentOption?: ITaskCustomColumnSelectionOption
  ) => (
    <Flex gap={8} align="center" key={selection.selection_id}>
      <Input
        ref={element => {
          inputRefs.current[selection.selection_id] = element;
        }}
        value={selection.selection_name}
        onChange={event =>
          updateSelection(selection.selection_id, { selection_name: event.target.value })
        }
        onPressEnter={event => {
          if (isUnassigned || !parentOption) {
            event.preventDefault();
            return;
          }
          handleGroupSelectionEnter(event, parentOption, selection);
        }}
        placeholder={t('customColumns.dependentSelection.optionPlaceholder', {
          defaultValue: 'Type an option and press Enter',
        })}
        style={{ flex: 1, minWidth: 0 }}
        aria-label={t('customColumns.dependentSelection.optionNameLabel', {
          defaultValue: 'Option name',
        })}
      />
      <SelectionColorPicker
        value={selection.selection_color}
        onChange={color => updateSelection(selection.selection_id, { selection_color: color })}
        ariaLabel={t('customColumns.dependentSelection.optionColorLabel', {
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
          htmlType="button"
          icon={<CloseCircleOutlined />}
          onClick={() => handleRemoveSelection(selection.selection_id)}
          aria-label={t('customColumns.dependentSelection.removeOption', {
            defaultValue: 'Remove option',
          })}
        />
      </Tooltip>
    </Flex>
  );

  return (
    <Flex vertical gap={8} style={{ maxWidth: '100%' }}>
      <Typography.Text style={{ fontSize: 13, fontWeight: 500 }}>
        {t('customColumns.dependentSelection.dependentOptions', {
          defaultValue: 'Dependent options',
        })}
      </Typography.Text>

      <div>
        {parentOptions.length === 0 ? (
          <Typography.Text type="secondary">
            {t('customColumns.dependentSelection.parentHasNoOptions', {
              defaultValue: '{{parent}} has no options yet. Add options to it first.',
              parent: parentName,
            })}
          </Typography.Text>
        ) : (
          <Flex vertical gap={10}>
            {parentOptions.map(parentOption => {
              const groupSelections = selections.filter(
                selection => selection.parent_selection_id === parentOption.selection_id
              );
              const draftValue = draftByParentId[parentOption.selection_id] || '';
              const addFocusKey = addInputFocusId(parentOption.selection_id);

              return (
                <div
                  key={parentOption.selection_id}
                  style={{
                    border: `1px dashed ${token.colorBorder}`,
                    borderRadius: token.borderRadiusLG,
                    padding: 12,
                  }}
                >
                  <Flex vertical gap={8}>
                    <Flex align="center" gap={8}>
                      <Badge color={parentOption.selection_color} />
                      <Typography.Text strong>{parentOption.selection_name}</Typography.Text>
                    </Flex>

                    {groupSelections.map(selection =>
                      renderSelectionRow(selection, false, parentOption)
                    )}

                    <Flex gap={6}>
                      <Input
                        ref={element => {
                          inputRefs.current[addFocusKey] = element;
                        }}
                        value={draftValue}
                        onChange={event =>
                          setDraftByParentId(prev => ({
                            ...prev,
                            [parentOption.selection_id]: event.target.value,
                          }))
                        }
                        onPressEnter={event => {
                          event.preventDefault();
                          handleAddSelections(parentOption, draftValue);
                        }}
                        aria-label={t('customColumns.dependentSelection.addUnderPlaceholder', {
                          defaultValue:
                            'New option under {{value}}… (comma-separated for multiple)',
                          value: parentOption.selection_name,
                        })}
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <Button
                        htmlType="button"
                        onClick={() => handleAddSelections(parentOption, draftValue)}
                      >
                        {t('customColumns.dependentSelection.addButton', {
                          defaultValue: '+ Add',
                        })}
                      </Button>
                    </Flex>
                  </Flex>
                </div>
              );
            })}
          </Flex>
        )}

        {unassignedSelections.length > 0 && (
          <div
            role="group"
            aria-label={t('customColumns.dependentSelection.unassigned', {
              defaultValue: 'Unassigned',
            })}
            style={{
              marginTop: 10,
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
