/* eslint-disable react-hooks/exhaustive-deps */
import { PlusOutlined } from '@/shared/antd-imports';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Dropdown,
  Flex,
  Input,
  InputRef,
  List,
  Typography,
} from '@/shared/antd-imports';
import React, { useMemo, useRef, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { colors } from '@/styles/colors';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { nanoid } from '@reduxjs/toolkit';
import { addLabel } from '@features/settings/label/labelSlice';
import { useTranslation } from 'react-i18next';
import { ITaskLabel } from '@/types/label.type';

interface LabelsSelectorProps {
  taskId: string | null;
  labels: ITaskLabel[];
}

const LabelsSelector = ({ taskId, labels }: LabelsSelectorProps) => {
  const labelInputRef = useRef<InputRef>(null);
  // this is for get the current string that type on search bar
  const [searchQuery, setSearchQuery] = useState<string>('');

  // localization
  const { t } = useTranslation('task-list-table');

  const dispatch = useAppDispatch();

  // get task list from redux and find the selected task
  const selectedTask = useAppSelector(state => state.taskReducer.tasks).find(
    task => task.id === taskId
  );

  // used useMemo hook for re-render the list when searching
  const filteredLabelData = useMemo(() => {
    return labels.filter(label => label.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [labels, searchQuery]);

  const handleCreateLabel = (name: string) => {
    if (name.length > 0) {
      const newLabel: ITaskLabel = {
        id: nanoid(),
        name,
        color_code: '#1E90FF',
      };

      dispatch(addLabel(newLabel));
      setSearchQuery('');
    }
  };

  // custom dropdown content
  const labelDropdownContent = (
    <Card
      className="custom-card"
      styles={{ body: { padding: 8, overflow: 'hidden', overflowY: 'auto', maxHeight: '255px' } }}
    >
      <Flex vertical gap={8}>
        <Input
          ref={labelInputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.currentTarget.value)}
          placeholder={t('searchInputPlaceholder')}
          onKeyDown={e => {
            const isLabel = filteredLabelData.findIndex(
              label => label.name?.toLowerCase() === searchQuery.toLowerCase()
            );

            if (isLabel === -1) {
              if (e.key === 'Enter') {
                handleCreateLabel(searchQuery);
              }
            }
          }}
        />

        <List style={{ padding: 0 }}>
          {filteredLabelData.length ? (
            filteredLabelData.map(label => (
              <List.Item
                className="custom-list-item"
                key={label.id}
                style={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  gap: 8,
                  padding: '4px 8px',
                  border: 'none',
                }}
              >
                <Checkbox
                  id={label.id}
                  checked={
                    selectedTask?.labels
                      ? selectedTask?.labels.some(existingLabel => existingLabel.id === label.id)
                      : false
                  }
                  onChange={() => console.log(123)}
                />

                <Flex gap={8}>
                  <Badge color={label.color_code} />
                  {label.name}
                </Flex>
              </List.Item>
            ))
          ) : (
            <Typography.Text
              style={{ color: colors.lightGray }}
              onClick={() => handleCreateLabel(searchQuery)}
            >
              {t('labelSelectorInputTip')}
            </Typography.Text>
          )}
        </List>

        <Divider style={{ margin: 0 }} />

        <Button
          type="primary"
          style={{ alignSelf: 'flex-end' }}
          onClick={() => handleCreateLabel(searchQuery)}
        >
          {t('okButton')}
        </Button>
      </Flex>
    </Card>
  );

  // function to focus label input
  const handleLabelDropdownOpen = (open: boolean) => {
    if (open) {
      setTimeout(() => {
        labelInputRef.current?.focus();
      }, 0);
    }
  };

  return (
    <Dropdown
      trigger={['click']}
      dropdownRender={() => labelDropdownContent}
      onOpenChange={handleLabelDropdownOpen}
    >
      <Button
        type="dashed"
        icon={<PlusOutlined style={{ fontSize: 11 }} />}
        style={{ height: 18 }}
        size="small"
      />
    </Dropdown>
  );
};

export default LabelsSelector;
