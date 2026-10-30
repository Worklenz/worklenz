import React, { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';
import { PhaseColorCodes } from '../../../../../../../../shared/constants';
import { Button, Flex, Input, Typography } from '@/shared/antd-imports';
import type { InputRef } from '@/shared/antd-imports';
import { CloseCircleOutlined, HolderOutlined } from '@/shared/antd-imports';

import { useAppDispatch } from '../../../../../../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../../../../../../hooks/useAppSelector';
import { setSelectionsList } from '../../../../../../../../features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import SelectionColorPicker from '../SelectionColorPicker';

export type SelectionType = {
  selection_color: string;
  selection_id: string;
  selection_name: string;
  parent_selection_id?: string | null;
};

const SelectionTypeColumn = () => {
  const { t } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();

  // Get the custom column modal type and column ID from the store
  const {
    customColumnModalType,
    customColumnId,
    currentColumnData,
    selectionsList: storeSelectionsList,
  } = useAppSelector(state => state.taskListCustomColumnsReducer);

  // Start from the store when it already has options (e.g. switching back from "Depends on").
  const [selections, setSelections] = useState<SelectionType[]>(() =>
    storeSelectionsList.length > 0
      ? storeSelectionsList.map(selection => ({ ...selection, parent_selection_id: null }))
      : [
        {
          selection_id: nanoid(),
          selection_name: '',
          selection_color: PhaseColorCodes[0],
        },
      ]
  );

  // Use the current column data passed from TaskListV2
  const openedColumn = currentColumnData;

  // Load existing selections when in edit mode, but only if the store is empty so
  // unsaved edits restored by selectParentColumn are not overwritten.
  useEffect(() => {
    if (storeSelectionsList.length > 0) return;

    if (customColumnModalType === 'edit' && openedColumn?.custom_column_obj?.selectionsList) {
      const existingSelections = openedColumn.custom_column_obj.selectionsList;

      if (Array.isArray(existingSelections) && existingSelections.length > 0) {
        setSelections(existingSelections);
        dispatch(setSelectionsList(existingSelections));
      }
    }
  }, [customColumnModalType, openedColumn, customColumnId, dispatch, storeSelectionsList.length]);

  // phase color options

  const inputRefs = useRef<Record<string, InputRef | null>>({});
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFocusId) return;
    inputRefs.current[pendingFocusId]?.focus();
    setPendingFocusId(null);
  }, [pendingFocusId, selections]);

  // add a new, empty selection and focus it
  const handleAddSelection = () => {
    const newSelection = {
      selection_id: nanoid(),
      selection_name: '',
      selection_color: PhaseColorCodes[selections.length % PhaseColorCodes.length],
    };
    setSelections(prevSelections => [...prevSelections, newSelection]);
    dispatch(setSelectionsList([...selections, newSelection])); // update the slice with the new selection
    setPendingFocusId(newSelection.selection_id);
  };

  // Enter moves to the next selection (adding one at the end) instead of submitting the form.
  const handleSelectionEnter = (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    event.preventDefault();
    if (!selections[index]?.selection_name.trim()) return;

    const nextSelection = selections[index + 1];
    if (nextSelection) {
      setPendingFocusId(nextSelection.selection_id);
    } else {
      handleAddSelection();
    }
  };

  // update selection name
  const handleUpdateSelectionName = (selectionId: string, selectionName: string) => {
    const updatedSelections = selections.map(selection =>
      selection.selection_id === selectionId
        ? { ...selection, selection_name: selectionName }
        : selection
    );
    setSelections(updatedSelections);
    dispatch(setSelectionsList(updatedSelections)); // update the slice with the new selection name
  };

  // update selection color
  const handleUpdateSelectionColor = (selectionId: string, selectionColor: string) => {
    const updatedSelections = selections.map(selection =>
      selection.selection_id === selectionId
        ? { ...selection, selection_color: selectionColor }
        : selection
    );
    setSelections(updatedSelections);
    dispatch(setSelectionsList(updatedSelections)); // update the slice with the new selection color
  };

  // remove a selection
  const handleRemoveSelection = (selectionId: string) => {
    const updatedSelections = selections.filter(
      selection => selection.selection_id !== selectionId
    );
    setSelections(updatedSelections);
    dispatch(setSelectionsList(updatedSelections)); // update the slice after selection removal
  };

  return (
    <div style={{ maxWidth: '100%' }}>
      <Typography.Text style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 8 }}>
        {t('customColumns.fieldTypeForms.selections')}
      </Typography.Text>
      <Flex vertical gap={8}>
        <Flex vertical gap={8} style={{ maxHeight: 160, overflow: 'auto' }}>
          {selections.map((selection, index) => (
            <Flex gap={8} align="center" key={selection.selection_id}>
              <HolderOutlined style={{ fontSize: 14, color: 'rgba(0,0,0,0.35)' }} />
              <Input
                ref={element => {
                  inputRefs.current[selection.selection_id] = element;
                }}
                value={selection.selection_name}
                onChange={e => handleUpdateSelectionName(selection.selection_id, e.target.value)}
                onPressEnter={event => handleSelectionEnter(event, index)}
                placeholder={t('customColumns.fieldTypeForms.selectionPlaceholder', {
                  defaultValue: 'Type a selection and press Enter',
                })}
                aria-label={t('customColumns.fieldTypeForms.selectionNameLabel', {
                  defaultValue: 'Selection name',
                })}
                size="small"
                style={{ maxWidth: 300 }}
              />
              <SelectionColorPicker
                value={selection.selection_color}
                onChange={color =>
                  handleUpdateSelectionColor(selection.selection_id, color)
                }
                ariaLabel={`${t('customColumns.fieldTypeForms.selectionNameLabel', {
                  defaultValue: 'Selection name',
                })}: ${selection.selection_name || ''} color`}
              />

              <CloseCircleOutlined
                onClick={() => handleRemoveSelection(selection.selection_id)}
                style={{ cursor: 'pointer' }}
              />
            </Flex>
          ))}
        </Flex>

        <Button
          type="link"
          size="small"
          onClick={handleAddSelection}
          style={{ width: 'fit-content', padding: 0 }}
        >
          {t('customColumns.fieldTypeForms.addSelection')}
        </Button>
      </Flex>
    </div>
  );
};

export default SelectionTypeColumn;
