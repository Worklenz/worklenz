import React, { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { PhaseColorCodes } from '../../../../../../../../shared/constants';
import { Button, Flex, Input, Select, Tag, Typography } from 'antd';
import { CloseCircleOutlined, HolderOutlined } from '@ant-design/icons';
import { useAppDispatch } from '../../../../../../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../../../../../../hooks/useAppSelector';
import { setLabelsList } from '../../../../../../../../features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';

export type LabelType = {
  label_id: string;
  label_name: string;
  label_color: string;
};

const LabelTypeColumn = () => {
  const dispatch = useAppDispatch();
  const [labels, setLabels] = useState<LabelType[]>([
    {
      label_id: nanoid(),
      label_name: 'Untitled label',
      label_color: PhaseColorCodes[0],
    },
  ]);

  // Get the custom column modal type and column ID from the store
  const { customColumnModalType, customColumnId } = useAppSelector(
    state => state.taskListCustomColumnsReducer
  );

  // Get the opened column data if in edit mode
  const openedColumn = useAppSelector(state =>
    state.taskReducer.customColumns.find(col => col.key === customColumnId)
  );

  // Load existing labels when in edit mode
  useEffect(() => {
    if (customColumnModalType === 'edit' && openedColumn?.custom_column_obj?.labelsList) {
      const existingLabels = openedColumn.custom_column_obj.labelsList;
      if (Array.isArray(existingLabels) && existingLabels.length > 0) {
        setLabels(existingLabels);
        dispatch(setLabelsList(existingLabels));
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

  // add a new label
  const handleAddLabel = () => {
    const newLabel = {
      label_id: nanoid(),
      label_name: 'Untitled label',
      label_color: PhaseColorCodes[0],
    };
    setLabels(prevLabels => [...prevLabels, newLabel]);
    dispatch(setLabelsList([...labels, newLabel])); // update the slice with the new label
  };

  // update label name
  const handleUpdateLabelName = (labelId: string, labelName: string) => {
    const updatedLabels = labels.map(label =>
      label.label_id === labelId ? { ...label, label_name: labelName } : label
    );
    setLabels(updatedLabels);
    dispatch(setLabelsList(updatedLabels)); // update the slice with the new label name
  };

  // update label color
  const handleUpdateLabelColor = (labelId: string, labelColor: string) => {
    const updatedLabels = labels.map(label =>
      label.label_id === labelId ? { ...label, label_color: labelColor } : label
    );
    setLabels(updatedLabels);
    dispatch(setLabelsList(updatedLabels)); // update the slice with the new label color
  };

  // remove a label
  const handleRemoveLabel = (labelId: string) => {
    const updatedLabels = labels.filter(label => label.label_id !== labelId);
    setLabels(updatedLabels);
    dispatch(setLabelsList(updatedLabels)); // update the slice after label removal
  };

  return (
    <div style={{ maxWidth: '100%', minHeight: 180 }}>
      <Typography.Text>Labels</Typography.Text>
      <Flex vertical gap={8}>
        <Flex vertical gap={8} style={{ maxHeight: 120, overflow: 'auto' }}>
          {labels.map(label => (
            <Flex gap={8} key={label.label_id}>
              <HolderOutlined style={{ fontSize: 18 }} />
              <Input
                value={label.label_name}
                onChange={e => handleUpdateLabelName(label.label_id, e.target.value)}
                style={{ width: 'fit-content', maxWidth: 400 }}
              />
              <Flex gap={8} align="center">
                <Select
                  options={phaseOptionColorList}
                  value={label.label_color}
                  onChange={value => handleUpdateLabelColor(label.label_id, value)}
                  style={{ width: 48 }}
                  suffixIcon={null}
                />
                <CloseCircleOutlined
                  onClick={() => handleRemoveLabel(label.label_id)}
                  style={{ cursor: 'pointer' }}
                />
              </Flex>
            </Flex>
          ))}
        </Flex>

        <Button type="link" onClick={handleAddLabel} style={{ width: 'fit-content', padding: 0 }}>
          + Add a label
        </Button>
      </Flex>
    </div>
  );
};

export default LabelTypeColumn;
