import React, { useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';
import { Button, Flex, Input, Tooltip, Typography } from '@/shared/antd-imports';
import type { InputRef } from '@/shared/antd-imports';
import { CloseCircleOutlined } from '@/shared/antd-imports';
import { PhaseColorCodes } from '@/shared/constants';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  INewParentFieldDraft,
  setNewParentField,
} from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import { SelectionType } from '../selection-type-column/selection-type-column';
import SelectionColorPicker from '../SelectionColorPicker';

const ADD_INPUT_FOCUS_ID = '__add_parent_option__';

const splitOptionLabels = (raw: string) =>
  raw
    .split(',')
    .map(label => label.trim())
    .filter(Boolean);

/**
 * Inline editor for "+ Create new parent field" inside Dependent Selection setup.
 * Saved together with the dependent child column on form submit.
 */
export const NewParentFieldEditor = () => {
  const { t } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();
  const draft = useAppSelector(state => state.taskListCustomColumnsReducer.newParentField);
  const [draftOption, setDraftOption] = useState('');
  const inputRefs = useRef<Record<string, InputRef | null>>({});
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFocusId) return;
    inputRefs.current[pendingFocusId]?.focus();
    setPendingFocusId(null);
  }, [pendingFocusId, draft?.selections]);

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

  const handleAddSelections = () => {
    const labels = splitOptionLabels(draftOption);
    if (!labels.length) return;

    updateDraft({
      selections: [
        ...draft.selections,
        ...labels.map((label, index) => ({
          selection_id: nanoid(),
          selection_name: label,
          selection_color:
            PhaseColorCodes[(draft.selections.length + index) % PhaseColorCodes.length],
        })),
      ],
    });
    setDraftOption('');
    setPendingFocusId(ADD_INPUT_FOCUS_ID);
  };

  const handleSelectionEnter = (
    event: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    event.preventDefault();
    if (!draft.selections[index]?.selection_name.trim()) return;

    const nextSelection = draft.selections[index + 1];
    if (nextSelection) {
      setPendingFocusId(nextSelection.selection_id);
    } else {
      // Last option → move focus to the "New parent option…" placeholder.
      setPendingFocusId(ADD_INPUT_FOCUS_ID);
    }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <Flex vertical gap={8}>
        <Typography.Text strong>
          {t('customColumns.dependentSelection.creatingNewParent', {
            defaultValue: 'Creating a new field to be the parent',
          })}
        </Typography.Text>

        <Input
          value={draft.name}
          onChange={event => updateDraft({ name: event.target.value })}
          onPressEnter={event => {
            event.preventDefault();
            const firstOption = draft.selections[0];
            setPendingFocusId(firstOption?.selection_id || ADD_INPUT_FOCUS_ID);
          }}
          placeholder={t('customColumns.dependentSelection.newParentNamePlaceholder', {
            defaultValue: 'Parent field title, e.g. Department',
          })}
          aria-label={t('customColumns.dependentSelection.newParentNameLabel', {
            defaultValue: 'Parent field title',
          })}
          style={{ fontWeight: 600 }}
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
              style={{ flex: 1, minWidth: 0 }}
              value={selection.selection_name}
              onChange={event =>
                updateSelection(selection.selection_id, { selection_name: event.target.value })
              }
              onPressEnter={event => handleSelectionEnter(event, index)}
              placeholder={t('customColumns.dependentSelection.optionPlaceholder', {
                defaultValue: 'Type an option and press Enter',
              })}
              aria-label={t('customColumns.dependentSelection.optionNameLabel', {
                defaultValue: 'Option name',
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
                htmlType="button"
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

        <Flex gap={6}>
          <Input
            ref={element => {
              inputRefs.current[ADD_INPUT_FOCUS_ID] = element;
            }}
            value={draftOption}
            onChange={event => setDraftOption(event.target.value)}
            onPressEnter={event => {
              event.preventDefault();
              handleAddSelections();
            }}
            aria-label={t('customColumns.dependentSelection.newParentAddPlaceholder', {
              defaultValue: 'New parent option… (comma-separated for multiple)',
            })}
            style={{ flex: 1, minWidth: 0 }}
          />
          <Button htmlType="button" onClick={handleAddSelections}>
            {t('customColumns.dependentSelection.addButton', { defaultValue: '+ Add' })}
          </Button>
        </Flex>
      </Flex>
    </div>
  );
};
