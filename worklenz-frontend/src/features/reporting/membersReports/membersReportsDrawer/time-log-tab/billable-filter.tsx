import { CaretDownFilled } from '@/shared/antd-imports';
import { Button, Card, Checkbox, Dropdown, List, Space } from '@/shared/antd-imports';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface BillableFilterProps {
  billable: { billable: boolean; nonBillable: boolean };
  onBillableChange: (value: { billable: boolean; nonBillable: boolean }) => void;
}

const BillableFilter = ({ billable, onBillableChange }: BillableFilterProps) => {
  // state to track dropdown open status
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // localization
  const { t } = useTranslation('reporting-members-drawer');

  // billable dropdown items
  type BillableFieldsType = {
    key: string;
    label: string;
  };

  const billableFieldsList: BillableFieldsType[] = [
    { key: 'billable', label: 'Billable' },
    { key: 'nonBillable', label: 'Non Billable' },
  ];

  // custom dropdown content
  const billableDropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 0 } }}>
      <List style={{ padding: 0 }}>
        {billableFieldsList.map(item => (
          <List.Item
            className="custom-list-item"
            key={item.key}
            style={{
              display: 'flex',
              gap: 8,
              padding: '4px 8px',
              border: 'none',
            }}
          >
            <Space>
              <Checkbox
                id={item.key}
                checked={billable[item.key as keyof typeof billable]}
                onChange={() =>
                  onBillableChange({
                    ...billable,
                    [item.key as keyof typeof billable]:
                      !billable[item.key as keyof typeof billable],
                  })
                }
              />
              {t(`${item.key}Text`)}
            </Space>
          </List.Item>
        ))}
      </List>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => billableDropdownContent}
      onOpenChange={open => setIsDropdownOpen(open)}
    >
      <Button
        icon={<CaretDownFilled />}
        iconPosition="end"
        style={{ width: 'fit-content' }}
        className={`transition-colors duration-300 ${
          isDropdownOpen
            ? 'border-[#1890ff] text-[#1890ff]'
            : 'hover:text-[#1890ff hover:border-[#1890ff]'
        }`}
      >
        {t('billableButton')}
      </Button>
    </Dropdown>
  );
};

export default BillableFilter;
