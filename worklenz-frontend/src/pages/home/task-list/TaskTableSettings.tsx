import React, { useMemo, useState } from 'react';
import {
  Button,
  Flex,
  Modal,
  Popconfirm,
  Space,
  Tabs,
  theme,
  PlusOutlined,
  ReloadOutlined,
  SortAscendingOutlined,
  UnorderedListOutlined,
  UserSwitchOutlined,
  type MenuProps,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setHomeTasksConfig } from '@/features/home-page/home-page.slice';
import {
  selectHomeSort,
  selectHomeTabs,
  setHomeSelections,
  setHomeTabs,
  type HomeAssignedGroup,
  type HomeSort,
} from '@/features/home-page/homePreferences.slice';
import { CustomizeAssignedPanel } from '../home-layout/CustomizeAssignedPanel';
import { CustomizeSortPanel } from '../home-layout/CustomizeSortPanel';
import { CustomizeTabsPanel } from '../home-layout/CustomizeTabsPanel';
import { DEFAULT_HOME_TABS, isDefaultHomeTabs, type HomeTabsConfig } from '../home-layout/homeTabs';
import { HomeWidgetMenuButton } from '../home-widgets/HomeWidgetMenuButton';
import { useHomePeriodMenuItems } from '../home-widgets/useHomePeriodMenuItems';

// How the Task priorities table is set up, reached from that widget's "..." menu: which tabs it
// has and in what order, which list it opens on, and how it is sorted. Each change applies and is
// saved straight away, like moving or removing a widget, so there is nothing to confirm.

export type TaskTableSettingsTab = 'tabs' | 'view' | 'sorting';

interface TaskTableSettingsMenuProps {
  /** Opens the table's "create task" dialog. */
  onCreateTask: () => void;
}

/**
 * The "..." menu of the Task priorities widget: the period shown, create a task, then the table's three settings.
 * The settings open their own dialog; creating a task is the table's own dialog, which it owns.
 */
export const TaskTableSettingsMenu: React.FC<TaskTableSettingsMenuProps> = ({ onCreateTask }) => {
  const { t } = useTranslation('home');
  const [openTab, setOpenTab] = useState<TaskTableSettingsTab | null>(null);

  const periodItems = useHomePeriodMenuItems();

  const items = useMemo<MenuProps['items']>(
    () => [
      ...periodItems,
      { type: 'divider' as const },
      {
        key: 'create',
        icon: <PlusOutlined aria-hidden />,
        label: t('tasks.createTask', { defaultValue: 'Create Task' }),
        onClick: onCreateTask,
      },
      { type: 'divider' as const },
      {
        key: 'tabs',
        icon: <UnorderedListOutlined aria-hidden />,
        label: t('customize.tabs.taskTabs', { defaultValue: 'Task tabs' }),
        onClick: () => setOpenTab('tabs'),
      },
      {
        key: 'view',
        icon: <UserSwitchOutlined aria-hidden />,
        label: t('customize.tabs.defaultView', { defaultValue: 'Default view' }),
        onClick: () => setOpenTab('view'),
      },
      {
        key: 'sorting',
        icon: <SortAscendingOutlined aria-hidden />,
        label: t('customize.tabs.sorting', { defaultValue: 'Sorting' }),
        onClick: () => setOpenTab('sorting'),
      },
    ],
    [t, onCreateTask, periodItems]
  );

  return (
    <>
      <HomeWidgetMenuButton extraItems={items} />
      <TaskTableSettingsModal
        open={openTab !== null}
        initialTab={openTab ?? 'tabs'}
        onClose={() => setOpenTab(null)}
      />
    </>
  );
};

interface TaskTableSettingsModalProps {
  open: boolean;
  /** The tab the dialog opens on; the one the menu entry that was picked stands for. */
  initialTab: TaskTableSettingsTab;
  onClose: () => void;
}

export const TaskTableSettingsModal: React.FC<TaskTableSettingsModalProps> = ({ open, initialTab, onClose }) => {
  const { t } = useTranslation('home');
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      centered
      // Unmounts the content once closed, so it always opens on the tab that was asked for.
      destroyOnHidden
      title={t('customize.tableTitle', { defaultValue: 'Customize task table' })}
      styles={{ body: { padding: 0 } }}
    >
      <TaskTableSettingsContent initialTab={initialTab} onDone={onClose} />
    </Modal>
  );
};

interface TaskTableSettingsContentProps {
  initialTab: TaskTableSettingsTab;
  onDone: () => void;
}

const TaskTableSettingsContent: React.FC<TaskTableSettingsContentProps> = ({ initialTab, onDone }) => {
  const { t } = useTranslation('home');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<TaskTableSettingsTab>(initialTab);

  const tabs = useAppSelector(selectHomeTabs);
  const sort = useAppSelector(selectHomeSort);
  const assignedDefault = useAppSelector(state => state.homePreferencesReducer.selections.pinnedAssignedGroup);
  const homeTasksConfig = useAppSelector(state => state.homePageReducer.homeTasksConfig);

  const handleTabsChange = (next: HomeTabsConfig) => dispatch(setHomeTabs(next));
  const handleSortChange = (next: HomeSort | null) => dispatch(setHomeSelections({ sort: next }));

  // Choosing a default also switches the table to it right away, so the effect is plain to see.
  const handleAssignedDefaultChange = (group: HomeAssignedGroup | null) => {
    dispatch(setHomeSelections({ pinnedAssignedGroup: group }));
    if (group !== null && homeTasksConfig.tasks_group_by !== group) {
      dispatch(setHomeTasksConfig({ ...homeTasksConfig, tasks_group_by: group }));
    }
  };

  const isDefault = isDefaultHomeTabs(tabs) && sort === null && assignedDefault === null;
  const handleReset = () => {
    dispatch(setHomeTabs(DEFAULT_HOME_TABS));
    dispatch(setHomeSelections({ sort: null, pinnedAssignedGroup: null }));
  };

  return (
    <>
      <Tabs
        size="small"
        style={{ padding: '0 24px' }}
        activeKey={activeTab}
        onChange={key => setActiveTab(key as TaskTableSettingsTab)}
        items={[
          {
            key: 'tabs',
            label: t('customize.tabs.taskTabs', { defaultValue: 'Task tabs' }),
            children: (
              <TabBody>
                <CustomizeTabsPanel tabs={tabs} onChange={handleTabsChange} />
              </TabBody>
            ),
          },
          {
            key: 'view',
            label: t('customize.tabs.defaultView', { defaultValue: 'Default view' }),
            children: (
              <TabBody>
                <CustomizeAssignedPanel assignedDefault={assignedDefault} onChange={handleAssignedDefaultChange} />
              </TabBody>
            ),
          },
          {
            key: 'sorting',
            label: t('customize.tabs.sorting', { defaultValue: 'Sorting' }),
            children: (
              <TabBody>
                <CustomizeSortPanel sort={sort} onChange={handleSortChange} />
              </TabBody>
            ),
          },
        ]}
      />

      <Flex
        justify="space-between"
        align="center"
        style={{ padding: '12px 24px', borderTop: `1px solid ${token.colorBorderSecondary}` }}
      >
        <Popconfirm
          title={t('customize.tableResetConfirm', { defaultValue: 'Reset the task table to its default settings?' })}
          okText={t('customize.reset', { defaultValue: 'Reset to default' })}
          cancelText={t('customize.cancel', { defaultValue: 'Cancel' })}
          onConfirm={handleReset}
          disabled={isDefault}
        >
          <Button icon={<ReloadOutlined aria-hidden />} disabled={isDefault}>
            {t('customize.reset', { defaultValue: 'Reset to default' })}
          </Button>
        </Popconfirm>
        <Space>
          <Button type="primary" onClick={onDone}>
            {t('customize.done', { defaultValue: 'Done' })}
          </Button>
        </Space>
      </Flex>
    </>
  );
};

/** A fixed minimum height, so the dialog doesn't jump in size as the short tab is switched to. */
const TabBody: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div style={{ minHeight: 300, maxHeight: 'min(60vh, 520px)', overflowY: 'auto', padding: '4px 4px 16px' }}>
    {children}
  </div>
);
