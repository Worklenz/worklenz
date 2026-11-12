import React, { useState } from 'react';
import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';
import { Button, Flex, Input, Tooltip, Typography, theme } from '@/shared/antd-imports';
import { CloseCircleOutlined, HolderOutlined } from '@/shared/antd-imports';
import { PhaseColorCodes } from '@/shared/constants';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  INewParentFieldDraft,
  setNewParentField,
} from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import { SelectionType } from '../selection-type-column/selection-type-column';
import SelectionColorPicker from '../SelectionColorPicker';

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
  const { token } = theme.useToken();
  const draft = useAppSelector(state => state.taskListCustomColumnsReducer.newParentField);
  const [draftOption, setDraftOption] = useState('');

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
  };

  return (
    <div
      style={{
        marginBottom: 12,
      }}
    >
      <Flex vertical gap={8}>
        <Typography.Text strong>
          {t('customColumns.dependentSelection.creatingNewParent', {
            defaultValue: 'Creating a new field to be the parent',
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
          style={{ fontWeight: 600 }}
        />

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('customColumns.dependentSelection.newParentOptions', {
            defaultValue: 'Parent field options',
          })}
        </Typography.Text>

        {draft.selections.map(selection => (
          <Flex gap={8} align="center" key={selection.selection_id}>
            <HolderOutlined style={{ fontSize: 14, color: token.colorTextQuaternary }} />
            <Input
              size="small"
              style={{ flex: 1, minWidth: 0 }}
              value={selection.selection_name}
              onChange={event =>
                updateSelection(selection.selection_id, { selection_name: event.target.value })
              }
              onPressEnter={event => event.preventDefault()}
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

        <Flex gap={6}>
          <Input
            size="small"
            value={draftOption}
            onChange={event => setDraftOption(event.target.value)}
            onPressEnter={event => {
              event.preventDefault();
              handleAddSelections();
            }}
            placeholder={t('customColumns.dependentSelection.newParentAddPlaceholder', {
              defaultValue: 'New parent option… (comma-separated for multiple)',
            })}
            style={{ flex: 1, minWidth: 0 }}
          />
          <Button size="small" htmlType="button" onClick={handleAddSelections}>
            {t('customColumns.dependentSelection.addButton', { defaultValue: '+ Add' })}
          </Button>
        </Flex>
      </Flex>
    </div>
  );
};
