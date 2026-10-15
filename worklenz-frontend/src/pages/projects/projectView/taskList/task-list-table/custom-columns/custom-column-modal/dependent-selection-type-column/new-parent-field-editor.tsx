import React, { useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';
import { Button, Flex, Input, Select, Tag, Tooltip, Typography, theme } from '@/shared/antd-imports';
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

/**
 * Inline editor for a brand-new Selection field that will become the parent of the field being
 * edited. It is created as its own column when the modal is saved.
 */
export const NewParentFieldEditor = () => {
  const { t } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const draft = useAppSelector(state => state.taskListCustomColumnsReducer.newParentField);
  const isFromExistingColumn = useAppSelector(
    state => state.taskListCustomColumnsReducer.customColumnModalType === 'edit'
  );
  const inputRefs = useRef<Record<string, InputRef | null>>({});
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFocusId) return;
    inputRefs.current[pendingFocusId]?.focus();
    setPendingFocusId(null);
  }, [pendingFocusId, draft]);

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
    <div
      style={{
        padding: 12,
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorPrimaryBorder}`,
        background: token.colorPrimaryBg,
      }}
    >
      <Flex vertical gap={8}>
        <Typography.Text strong>
          {t('customColumns.dependentSelection.newParentTitle', {
            defaultValue: 'New parent field',
          })}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('customColumns.dependentSelection.newParentHint', {
            defaultValue:
              'This creates a separate Selection column when you click Update. Its options become the groups below.',
          })}
        </Typography.Text>

        {isFromExistingColumn && (
          <>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('customColumns.dependentSelection.newChildHint', {
                defaultValue:
                  'This field keeps its current parent and options. A new child field is created for the new parent instead.',
              })}
            </Typography.Text>
            <Input
              size="small"
              value={draft.childName}
              onChange={event => updateDraft({ childName: event.target.value })}
              onPressEnter={event => event.preventDefault()}
              placeholder={t('customColumns.dependentSelection.newChildNamePlaceholder', {
                defaultValue: 'New child field title, e.g. Team',
              })}
              aria-label={t('customColumns.dependentSelection.newChildNameLabel', {
                defaultValue: 'New child field title',
              })}
            />
          </>
        )}

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
