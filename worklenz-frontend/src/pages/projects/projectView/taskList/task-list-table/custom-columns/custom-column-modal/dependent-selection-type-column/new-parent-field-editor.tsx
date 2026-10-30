import React, { useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';
import { Button, Flex, Input, Tooltip, Typography, theme } from '@/shared/antd-imports';
import { CloseCircleOutlined } from '@/shared/antd-imports';
import type { InputRef } from '@/shared/antd-imports';
import { PhaseColorCodes } from '@/shared/constants';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  INewParentFieldDraft,
  setNewParentField,
} from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import { SelectionType } from '../selection-type-column/selection-type-column';
import SelectionColorPicker from '../SelectionColorPicker';

/**
 * Inline editor for "+ Create new parent field": name + flat options for a standalone parent
 * Selection column. Saved as its own column; child columns are added later via Depends on.
 */
export const NewParentFieldEditor = () => {
  const { t } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();
  const draft = useAppSelector(state => state.taskListCustomColumnsReducer.newParentField);
  const inputRefs = useRef<Record<string, InputRef | null>>({});
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFocusId) return;
    inputRefs.current[pendingFocusId]?.focus();
    setPendingFocusId(null);
  }, [pendingFocusId, draft]);

  if (!draft) return null;

  const updateDraft = (changes: Partial<INewParentFieldDraft>) => {
    dispatch(setNewParentField({ ...draft, ...changes }));
  };

  const updateSelection = (selectionId: string, changes: Partial<SelectionType>) => {
    updateDraft({
      selections: draft.selections.map(selection =>
        selection.selection_id === selectionId ? { ...selection, ...changes } : selection
      ),
    });
  };

  const handleAddSelection = () => {
    const selectionId = nanoid();
    updateDraft({
      selections: [
        ...draft.selections,
        {
          selection_id: selectionId,
          selection_name: '',
          selection_color: PhaseColorCodes[draft.selections.length % PhaseColorCodes.length],
        },
      ],
    });
    setPendingFocusId(selectionId);
  };

  const handleSelectionEnter = (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    event.preventDefault();
    if (!draft.selections[index]?.selection_name.trim()) return;

    const nextSelection = draft.selections[index + 1];
    if (nextSelection) {
      setPendingFocusId(nextSelection.selection_id);
    } else {
      handleAddSelection();
    }
  };

  return (
    <div>
    
      <Flex vertical gap={8}>
        <Typography.Text strong>
          {t('customColumns.dependentSelection.newParentTitle', {
            defaultValue: 'New parent field',
          })}
        </Typography.Text>

        <Input
          size="small"
          value={draft.name}
          onChange={event => updateDraft({ name: event.target.value })}
          onPressEnter={event => event.preventDefault()}
          placeholder={t('customColumns.dependentSelection.newParentNamePlaceholder', {
            defaultValue: 'Parent field title, e.g. Department',
          })}
          aria-label={t('customColumns.dependentSelection.newParentNameLabel', {
            defaultValue: 'Parent field title',
          })}
        />

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('customColumns.dependentSelection.newParentOptions', {
            defaultValue: 'Parent field options',
          })}
        </Typography.Text>

        {draft.selections.map((selection, index) => (
          <Flex gap={8} align="center" key={selection.selection_id}>
            <Input
              ref={element => {
                inputRefs.current[selection.selection_id] = element;
              }}
              size="small"
              style={{ flex: 1, minWidth: 0 }}
              value={selection.selection_name}
              onChange={event =>
                updateSelection(selection.selection_id, { selection_name: event.target.value })
              }
              onPressEnter={event => handleSelectionEnter(event, index)}
              placeholder={t('customColumns.fieldTypeForms.selectionPlaceholder', {
                defaultValue: 'Type a selection and press Enter',
              })}
              aria-label={t('customColumns.fieldTypeForms.selectionNameLabel', {
                defaultValue: 'Selection name',
              })}
            />
            <SelectionColorPicker
              value={selection.selection_color}
              onChange={color =>
                updateSelection(selection.selection_id, { selection_color: color })
              }
              ariaLabel={t('customColumns.dependentSelection.optionColorLabel', {
                defaultValue: 'Option color',
              })}
            />
            <Tooltip
              title={t('customColumns.dependentSelection.removeOption', {
                defaultValue: 'Remove option',
              })}
            >
              <Button
                type="text"
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={() =>
                  updateDraft({
                    selections: draft.selections.filter(
                      item => item.selection_id !== selection.selection_id
                    ),
                  })
                }
                aria-label={t('customColumns.dependentSelection.removeOption', {
                  defaultValue: 'Remove option',
                })}
              />
            </Tooltip>
          </Flex>
        ))}

        <Button
          type="link"
          size="small"
          onClick={handleAddSelection}
          style={{ width: 'fit-content', padding: 0 }}
        >
          {t('customColumns.fieldTypeForms.addSelection', { defaultValue: '+ Add a selection' })}
        </Button>
      </Flex>
    </div>
  );
};
