import { Card, Dropdown, Flex, Menu, MenuProps, Typography } from '@/shared/antd-imports';
import React, { useState } from 'react';
import {
  DoubleLeftOutlined,
  DownOutlined,
  MinusOutlined,
  PauseOutlined,
} from '@/shared/antd-imports';
// custom css file
import './priorityDropdown.css';
import { colors } from '../../../styles/colors';
import { TaskPriorityType } from '../../../types/task.types';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { getPriorityColor } from '../../../utils/getPriorityColors';

type PriorityDropdownProps = {
  currentPriority: TaskPriorityType | string;
};

const PriorityDropdown = ({ currentPriority }: PriorityDropdownProps) => {
  const [priority, setPriority] = useState<TaskPriorityType | string>(currentPriority);

  // localization
  const { t } = useTranslation('task-list-table');

  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // menu type
  type MenuItem = Required<MenuProps>['items'][number];
  // priority menu item
  const priorityMenuItems: MenuItem[] = [
    {
      key: 'low',
      label: (
        <Flex gap={4}>
          {t('lowSelectorText')}
          <MinusOutlined style={{ color: getPriorityColor('low', themeMode) }} />
        </Flex>
      ),
    },
    {
      key: 'medium',
      label: (
        <Flex gap={4}>
          {t('mediumSelectorText')}
          <PauseOutlined
            style={{
              color: getPriorityColor('medium', themeMode),
              rotate: '90deg',
            }}
          />
        </Flex>
      ),
    },
    {
      key: 'high',
      label: (
        <Flex gap={4}>
          {t('highSelectorText')}
          <DoubleLeftOutlined
            style={{
              color: getPriorityColor('high', themeMode),
              rotate: '90deg',
            }}
          />
        </Flex>
      ),
    },
  ];

  // handle priority select
  const onClick: MenuProps['onClick'] = e => {
    e.key === 'low'
      ? setPriority('low')
      : e.key === 'medium'
        ? setPriority('medium')
        : setPriority('high');
  };

  //dropdown items
  const priorityDropdownItems: MenuProps['items'] = [
    {
      key: '1',
      label: (
        <Card className="priority-dropdown-card" bordered={false}>
          <Menu
            className="priority-menu"
            items={priorityMenuItems}
            defaultValue={currentPriority}
            onClick={onClick}
          />
        </Card>
      ),
    },
  ];

  return (
    <Dropdown
      overlayClassName="priority-dropdown"
      menu={{ items: priorityDropdownItems }}
      placement="bottomRight"
      trigger={['click']}
    >
      <Flex
        gap={6}
        align="center"
        style={{
          width: 'fit-content',
          borderRadius: 24,
          paddingInline: 8,
          height: 22,
          backgroundColor: getPriorityColor(priority, themeMode),
          color: colors.darkGray,
          cursor: 'pointer',
        }}
      >
        <Typography.Text
          style={{
            textTransform: 'capitalize',
            color: colors.darkGray,
            fontSize: 13,
          }}
        >
          {t(priority + 'SelectorText')}
        </Typography.Text>

        <DownOutlined />
      </Flex>
    </Dropdown>
  );
};

export default PriorityDropdown;
