import {
  Badge,
  Card,
  Dropdown,
  Empty,
  Flex,
  Menu,
  MenuProps,
  Typography,
} from '@/shared/antd-imports';
import React, { useState, useEffect } from 'react';
import { DownOutlined } from '@/shared/antd-imports';
// custom css file
import './custom-column-label-cell.css';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../../../../../../styles/colors';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';

const CustomColumnLabelCell = ({
  labelsList,
  selectedLabels = [],
  onChange,
}: {
  labelsList: ITaskLabel[];
  selectedLabels?: string[];
  onChange?: (labels: string[]) => void;
}) => {
  const [currentLabelOption, setCurrentLabelOption] = useState<ITaskLabel | null>(null);

  // localization
  const { t } = useTranslation('task-list-table');

  // Set initial selection based on selectedLabels prop
  useEffect(() => {
    if (selectedLabels && selectedLabels.length > 0 && labelsList.length > 0) {
      const selectedLabel = labelsList.find(label => label.id && selectedLabels.includes(label.id));
      if (selectedLabel) {
        setCurrentLabelOption(selectedLabel);
      }
    }
  }, [selectedLabels, labelsList]);

  // ensure labelsList is an array and has valid data
  const labelMenuItems: MenuProps['items'] =
    Array.isArray(labelsList) && labelsList.length > 0
      ? labelsList
          .filter(label => label.id) // Filter out items without an id
          .map(label => ({
            key: label.id as string, // Assert that id is a string
            label: (
              <Flex gap={4}>
                <Badge color={label.color_code} /> {label.name}
              </Flex>
            ),
            type: 'item' as const,
          }))
      : [
          {
            key: 'noLabels',
            label: <Empty />,
          },
        ];

  // handle label selection
  const handleLabelOptionSelect: MenuProps['onClick'] = e => {
    const selectedOption = labelsList.find(option => option.id === e.key);
    if (selectedOption && selectedOption.id) {
      setCurrentLabelOption(selectedOption);
      // Call the onChange callback if provided
      if (onChange) {
        onChange([selectedOption.id]);
      }
    }
  };

  // dropdown items
  const customColumnLabelCellItems: MenuProps['items'] = [
    {
      key: '1',
      label: (
        <Card className="custom-column-label-dropdown-card" bordered={false}>
          <Menu
            className="custom-column-label-menu"
            items={labelMenuItems}
            onClick={handleLabelOptionSelect}
          />
        </Card>
      ),
    },
  ];

  return (
    <Dropdown
      overlayClassName="custom-column-label-dropdown"
      menu={{ items: customColumnLabelCellItems }}
      placement="bottomRight"
      trigger={['click']}
    >
      <Flex
        gap={6}
        align="center"
        justify="space-between"
        style={{
          width: 'fit-content',
          borderRadius: 24,
          paddingInline: 8,
          height: 22,
          fontSize: 13,
          backgroundColor: currentLabelOption?.color_code || colors.transparent,
          color: colors.darkGray,
          cursor: 'pointer',
        }}
      >
        {currentLabelOption ? (
          <Typography.Text
            ellipsis={{ expanded: false }}
            style={{
              textTransform: 'capitalize',
              fontSize: 13,
            }}
          >
            {currentLabelOption?.name}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {t('selectText')}
          </Typography.Text>
        )}

        <DownOutlined style={{ fontSize: 12 }} />
      </Flex>
    </Dropdown>
  );
};

export default CustomColumnLabelCell;
