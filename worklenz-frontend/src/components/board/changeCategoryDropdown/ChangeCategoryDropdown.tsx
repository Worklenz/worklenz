import { Badge, Card, Dropdown, Flex, Menu, MenuProps } from '@/shared/antd-imports';
import React from 'react';
import { TaskStatusType } from '../../../types/task.types';
import { colors } from '../../../styles/colors';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { RetweetOutlined, RightOutlined } from '@/shared/antd-imports';
import './ChangeCategoryDropdown.css';
import { updateStatusCategory } from '../../../features/projects/status/StatusSlice';
import { useTranslation } from 'react-i18next';

interface ChangeCategoryDropdownProps {
  id: string;
}

const ChangeCategoryDropdown: React.FC<ChangeCategoryDropdownProps> = ({ id }) => {
  const dispatch = useAppDispatch();
  // const [currentStatus, setCurrentStatus] = useState(category);
  const { t } = useTranslation('kanban-board');

  const getStatuColor = (status: TaskStatusType) => {
    if (status === 'todo') return colors.deepLightGray;
    else if (status === 'doing') return colors.midBlue;
    else return colors.lightGreen;
  };

  // menu type
  type MenuItem = Required<MenuProps>['items'][number];
  // status menu item
  const statusMenuItems: MenuItem[] = [
    {
      key: 'todo',
      label: (
        <Flex gap={4}>
          <Badge color={getStatuColor('todo')} /> Todo
        </Flex>
      ),
    },
    {
      key: 'doing',
      label: (
        <Flex gap={4}>
          <Badge color={getStatuColor('doing')} /> Doing
        </Flex>
      ),
    },
    {
      key: 'done',
      label: (
        <Flex gap={4}>
          <Badge color={getStatuColor('done')} /> Done
        </Flex>
      ),
    },
  ];

  const onClick: MenuProps['onClick'] = e => {
    if (e.key === 'todo') {
      dispatch(updateStatusCategory({ id: id, category: 'todo' }));
    } else if (e.key === 'doing') {
      dispatch(updateStatusCategory({ id: id, category: 'doing' }));
    } else if (e.key === 'done') {
      dispatch(updateStatusCategory({ id: id, category: 'done' }));
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
            defaultValue={'todo'}
            onClick={onClick}
          />
        </Card>
      ),
    },
  ];

  return (
    <>
      <Dropdown
        menu={{ items: statusDropdownItems }}
        overlayStyle={{
          paddingLeft: '185px',
          paddingBottom: '100px',
          top: '350px',
        }}
        overlayClassName="status-drawer-dropdown"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            width: '100%',
            padding: '5px 12px',
            gap: '8px',
          }}
        >
          <RetweetOutlined /> <span>{t('changeCategory')}</span>{' '}
          <RightOutlined style={{ color: '#00000073', fontSize: '10px' }} />
        </div>
      </Dropdown>
    </>
  );
};

export default ChangeCategoryDropdown;
