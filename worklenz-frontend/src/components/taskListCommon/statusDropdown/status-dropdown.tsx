import Badge from 'antd/es/badge';
import Card from 'antd/es/card';
import Dropdown from 'antd/es/dropdown';
import Flex from 'antd/es/flex';
import Menu from 'antd/es/menu';
import type { MenuProps } from 'antd/es/menu';
import Typography from 'antd/es/typography';
import React, { useEffect, useState } from 'react';
import { DownOutlined } from '@ant-design/icons';
import './statusDropdown.css';
import { colors } from '../../../styles/colors';
import { useAppSelector } from '@/hooks/use-app-selector';
import { useTranslation } from 'react-i18next';
import { getStatusColor } from '../../../utils/getStatusColor';
import { themeWiseColor } from '../../../utils/themeWiseColor';

type StatusDropdownProps = {
  currentStatus: string;
};

const StatusDropdown = ({ currentStatus }: StatusDropdownProps) => {
  const [status, setStatus] = useState<string>(currentStatus);
  const [statusName, setStatusName] = useState<string>('');

  // localization
  const { t } = useTranslation('task-list-table');

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const statusList = useAppSelector(state => state.statusReducer.status);

  // this is trigger only on status list update
  useEffect(() => {
    const selectedStatus = statusList.find(el => el.category === status);
    setStatusName(selectedStatus?.name || '');
  }, [statusList]);

  type MenuItem = Required<MenuProps>['items'][number];

  const statusMenuItems: MenuItem[] = statusList
    ? statusList.map(status => ({
        key: status.id,
        label: (
          <Flex gap={8} align="center">
            <Badge color={getStatusColor(status.category, themeMode)} />
            <Typography.Text>
              {status.name === 'To do' || status.name === 'Doing' || status.name === 'Done'
                ? t(status.category + 'SelectorText')
                : status.name}
            </Typography.Text>
          </Flex>
        ),
      }))
    : [];

  const handleStatusOptionSelect: MenuProps['onClick'] = e => {
    const selectedOption = statusList.find(el => el.id === e.key);
    if (selectedOption) {
      setStatusName(
        selectedOption.name === 'To do' ||
          selectedOption.name === 'Doing' ||
          selectedOption.name === 'Done'
          ? t(selectedOption.category + 'SelectorText')
          : selectedOption.name
      );
      setStatus(selectedOption.category);
    }
  };

  const statusDropdownItems: MenuProps['items'] = [
    {
      key: '1',
      label: (
        <Card className="status-dropdown-card" bordered={false}>
          <Menu
            className="status-menu"
            items={statusMenuItems}
            onClick={handleStatusOptionSelect}
          />
        </Card>
      ),
    },
  ];

  return (
    <Dropdown
      overlayClassName="status-dropdown"
      menu={{ items: statusDropdownItems }}
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
          backgroundColor: getStatusColor(status, themeMode),
          color: colors.darkGray,
          cursor: 'pointer',
        }}
      >
        <Typography.Text
          ellipsis={{ expanded: false }}
          style={{
            fontSize: 13,
            color: colors.darkGray,
            fontWeight: 400,
          }}
        >
          {statusName}
        </Typography.Text>
        <DownOutlined style={{ fontSize: 12 }} />
      </Flex>
    </Dropdown>
  );
};

export default StatusDropdown;
