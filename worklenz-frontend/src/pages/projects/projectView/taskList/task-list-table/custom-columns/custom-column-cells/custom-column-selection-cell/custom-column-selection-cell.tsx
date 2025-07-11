import { Badge, Card, Dropdown, Empty, Flex, Menu, MenuProps, Typography } from 'antd';
import React, { useState, useEffect } from 'react';
import { DownOutlined } from '@ant-design/icons';
// custom css file
import './custom-column-selection-cell.css';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../../../../../../styles/colors';
import { SelectionType } from '../../custom-column-modal/selection-type-column/selection-type-column';
import { ALPHA_CHANNEL } from '@/shared/constants';

const CustomColumnSelectionCell = ({
  selectionsList,
  value,
  onChange,
}: {
  selectionsList: SelectionType[];
  value?: string;
  onChange?: (value: string) => void;
}) => {
  const [currentSelectionOption, setCurrentSelectionOption] = useState<SelectionType | null>(null);

  // localization
  const { t } = useTranslation('task-list-table');

  // Debug the selectionsList and value
  console.log('CustomColumnSelectionCell props:', {
    selectionsList,
    value,
    selectionsCount: selectionsList?.length || 0,
  });

  // Set initial selection based on value prop
  useEffect(() => {
    if (value && Array.isArray(selectionsList) && selectionsList.length > 0) {
      const selectedOption = selectionsList.find(option => option.selection_id === value);
      console.log('Found selected option:', selectedOption);
      if (selectedOption) {
        setCurrentSelectionOption(selectedOption);
      }
    }
  }, [value, selectionsList]);

  // ensure selectionsList is an array and has valid data
  const selectionMenuItems: MenuProps['items'] =
    Array.isArray(selectionsList) && selectionsList.length > 0
      ? selectionsList.map(selection => ({
          key: selection.selection_id,
          label: (
            <Flex gap={4}>
              <Badge color={selection.selection_color + ALPHA_CHANNEL} /> {selection.selection_name}
            </Flex>
          ),
        }))
      : [
          {
            key: 'noSelections',
            label: <Empty description="No selections available" />,
          },
        ];

  // handle selection selection
  const handleSelectionOptionSelect: MenuProps['onClick'] = e => {
    if (e.key === 'noSelections') return;

    const selectedOption = selectionsList.find(option => option.selection_id === e.key);
    if (selectedOption) {
      setCurrentSelectionOption(selectedOption);
      // Call the onChange callback if provided
      if (onChange) {
        onChange(selectedOption.selection_id);
      }
    }
  };

  // dropdown items
  const customColumnSelectionCellItems: MenuProps['items'] = [
    {
      key: '1',
      label: (
        <Card className="custom-column-selection-dropdown-card" variant="borderless">
          <Menu
            className="custom-column-selection-menu"
            items={selectionMenuItems}
            onClick={handleSelectionOptionSelect}
          />
        </Card>
      ),
    },
  ];

  return (
    <Dropdown
      overlayClassName="custom-column-selection-dropdown"
      menu={{ items: customColumnSelectionCellItems }}
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
          backgroundColor:
            currentSelectionOption?.selection_color + ALPHA_CHANNEL || colors.transparent,
          color: colors.darkGray,
          cursor: 'pointer',
        }}
      >
        {currentSelectionOption ? (
          <Typography.Text
            ellipsis={{ expanded: false }}
            style={{
              textTransform: 'capitalize',
              fontSize: 13,
            }}
          >
            {currentSelectionOption?.selection_name}
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

export default CustomColumnSelectionCell;
