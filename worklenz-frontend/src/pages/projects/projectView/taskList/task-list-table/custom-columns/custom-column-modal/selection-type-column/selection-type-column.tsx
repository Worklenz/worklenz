import React, { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { PhaseColorCodes } from '../../../../../../../../shared/constants';
import { Button, Flex, Input, Select, Tag, Typography } from '@/shared/antd-imports';
import { CloseCircleOutlined, HolderOutlined } from '@/shared/antd-imports';

import { useAppDispatch } from '../../../../../../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../../../../../../hooks/useAppSelector';
import { setSelectionsList } from '../../../../../../../../features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';

export type SelectionType = {
  selection_color: string;
  selection_id: string;
  selection_name: string;
};

const SelectionTypeColumn = () => {
  const dispatch = useAppDispatch();
  const [selections, setSelections] = useState<SelectionType[]>([
    {
      selection_id: nanoid(),
      selection_name: 'Untitled selection',
      selection_color: PhaseColorCodes[0],
    },
  ]);

  // Get the custom column modal type and column ID from the store
  const {
    customColumnModalType,
    customColumnId,
    currentColumnData,
    selectionsList: storeSelectionsList,
  } = useAppSelector(state => state.taskListCustomColumnsReducer);

  // Use the current column data passed from TaskListV2
  const openedColumn = currentColumnData;

  // Load existing selections when in edit mode
  useEffect(() => {
    if (customColumnModalType === 'edit' && openedColumn?.custom_column_obj?.selectionsList) {
      const existingSelections = openedColumn.custom_column_obj.selectionsList;

      if (Array.isArray(existingSelections) && existingSelections.length > 0) {
        setSelections(existingSelections);
        dispatch(setSelectionsList(existingSelections));
      }
    }
  }, [customColumnModalType, openedColumn, customColumnId, dispatch]);

  // phase color options
  const phaseOptionColorList = PhaseColorCodes.map(color => ({
    value: color,
    label: (
      <Tag
        color={color}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: 15,
          height: 15,
          borderRadius: '50%',
        }}
      />
    ),
  }));

  // add a new selection
  const handleAddSelection = () => {
    const newSelection = {
      selection_id: nanoid(),
      selection_name: 'Untitled selection',
      selection_color: PhaseColorCodes[0],
    };
    setSelections(prevSelections => [...prevSelections, newSelection]);
    dispatch(setSelectionsList([...selections, newSelection])); // update the slice with the new selection
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
    <div style={{ maxWidth: '100%', minHeight: 180 }}>
      <Typography.Text>Selections</Typography.Text>
      <Flex vertical gap={8}>
        <Flex vertical gap={8} style={{ maxHeight: 120, overflow: 'auto' }}>
          {selections.map(selection => (
            <Flex gap={8} key={selection.selection_id}>
              <HolderOutlined style={{ fontSize: 18 }} />
              <Input
                value={selection.selection_name}
                onChange={e => handleUpdateSelectionName(selection.selection_id, e.target.value)}
                style={{ width: 'fit-content', maxWidth: 400 }}
              />
              <Flex gap={8} align="center">
                <Select
                  options={phaseOptionColorList}
                  value={selection.selection_color}
                  onChange={value => handleUpdateSelectionColor(selection.selection_id, value)}
                  style={{ width: 48 }}
                  suffixIcon={null}
                />

                <CloseCircleOutlined
                  onClick={() => handleRemoveSelection(selection.selection_id)}
                  style={{ cursor: 'pointer' }}
                />
              </Flex>
            </Flex>
          ))}
        </Flex>

        <Button
          type="link"
          onClick={handleAddSelection}
          style={{ width: 'fit-content', padding: 0 }}
        >
          + Add a selection
        </Button>
      </Flex>
    </div>
  );
};

export default SelectionTypeColumn;
