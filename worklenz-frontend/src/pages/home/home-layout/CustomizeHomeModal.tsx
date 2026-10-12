import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Flex, Modal, Popconfirm, Space, Tabs, theme, ReloadOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setHomeTasksConfig } from '@/features/home-page/home-page.slice';
import {
  clearHomePreview,
  commitHomePreview,
  setHomePreview,
  type HomeAssignedGroup,
  type HomeSort,
} from '@/features/home-page/homePreferences.slice';
import { clearNavPreview, commitNavPreview, setNavPreview } from '@/features/navigation/navPreferences.slice';
import { useNavPreferences } from '@/features/navigation/useNavPreferences';
import { CustomizeLayoutPanel } from './CustomizeLayoutPanel';
import { CustomizeSidebarPanel } from './CustomizeSidebarPanel';
import { CustomizeSortPanel } from './CustomizeSortPanel';
import { CustomizeTabsPanel } from './CustomizeTabsPanel';
import { DEFAULT_HOME_LAYOUT, isDefaultHomeLayout, type HomeLayout } from './homeLayout';
import { isSameSidebarDraft, type HomeSidebarDraft } from './homeSidebar';
import { DEFAULT_HOME_TABS, isDefaultHomeTabs, type HomeTabsConfig } from './homeTabs';

// Everything the dialog edits. The page shows the draft live in the background (it is held in the
// store as a non-persisted preview); Save makes it permanent, and closing any other way throws it
// away and the page goes back to what was saved.

interface CustomizeHomeModalProps {
  open: boolean;
  onClose: () => void;
}

interface CustomizeDraft {
  layout: HomeLayout;
  tabs: HomeTabsConfig;
  sort: HomeSort | null;
  assignedDefault: HomeAssignedGroup | null;
  sidebar: HomeSidebarDraft;
}

export const CustomizeHomeModal: React.FC<CustomizeHomeModalProps> = ({ open, onClose }) => {
  const { t } = useTranslation('home');
  const dispatch = useAppDispatch();
  const homeTasksConfig = useAppSelector(state => state.homePageReducer.homeTasksConfig);

  // Previewing can move the table to another tab (a hidden one) or another assigned group (a new
  // default); remember where the user was so a cancel can put it back.
  const configRef = useRef(homeTasksConfig);
  configRef.current = homeTasksConfig;
  const atOpenRef = useRef<{ tab: typeof homeTasksConfig.current_tab; group: number } | null>(null);
  useEffect(() => {
    if (open) {
      atOpenRef.current = {
        tab: configRef.current.current_tab,
        group: configRef.current.tasks_group_by,
      };
    }
  }, [open]);

  // Every way of closing without saving (Cancel, the X, Esc, clicking outside) comes through here.
  const handleCancel = () => {
    dispatch(clearHomePreview());
    dispatch(clearNavPreview());
    const atOpen = atOpenRef.current;
    if (
      atOpen &&
      (atOpen.tab !== configRef.current.current_tab || atOpen.group !== configRef.current.tasks_group_by)
    ) {
      dispatch(
        setHomeTasksConfig({
          ...configRef.current,
          current_tab: atOpen.tab,
          tasks_group_by: atOpen.group,
        })
      );
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={640}
      centered
      // Unmounts the content once closed, so the draft below always starts from the saved settings.
      destroyOnHidden
      title={t('customize.title', { defaultValue: 'Customize Home' })}
      styles={{ body: { padding: 0 }, mask: { background: 'rgba(0, 0, 0, 0.15)' } }}
    >
      <CustomizeHomeContent onSave={onClose} onCancel={handleCancel} />
    </Modal>
  );
};

interface CustomizeHomeContentProps {
  onSave: () => void;
  onCancel: () => void;
}

const CustomizeHomeContent: React.FC<CustomizeHomeContentProps> = ({ onSave, onCancel }) => {
  const { t } = useTranslation('home');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const saved = useAppSelector(state => state.homePreferencesReducer);
  const homeTasksConfig = useAppSelector(state => state.homePageReducer.homeTasksConfig);
  const { surface, allItems, hiddenKeys, isPinned } = useNavPreferences('home');

  const sidebarGroupKey = surface.groups[0]?.key ?? '';
  // Every item the user may see, hidden ones too, so a hidden item can be shown again.
  const sidebarItems = useMemo(() => new Map(allItems.map(item => [item.key, item])), [allItems]);
  const defaultSidebar = useMemo<HomeSidebarDraft>(
    () => ({
      order: (surface.groups[0]?.items ?? []).map(item => item.key).filter(key => sidebarItems.has(key)),
      hidden: [],
      pinned: null,
    }),
    [surface.groups, sidebarItems]
  );

  // Captured once on mount, before any preview is applied: what "unchanged" means.
  const [initialDraft] = useState<CustomizeDraft>(() => {
    const order = allItems.map(item => item.key);
    return {
      layout: saved.layout,
      tabs: saved.tabs,
      sort: saved.selections.sort,
      assignedDefault: saved.selections.pinnedAssignedGroup,
      sidebar: { order, hidden: hiddenKeys.filter(key => order.includes(key)), pinned: order.find(isPinned) ?? null },
    };
  });
  const [draft, setDraft] = useState<CustomizeDraft>(initialDraft);

  // Show the draft on the page as it changes. It is a preview only: nothing is persisted until Save.
  useEffect(() => {
    dispatch(
      setHomePreview({
        layout: draft.layout,
        tabs: draft.tabs,
        sort: draft.sort,
        assignedDefault: draft.assignedDefault,
      })
    );
    dispatch(
      setNavPreview({
        surfaceKey: 'home',
        groupOrder: { [sidebarGroupKey]: draft.sidebar.order },
        pinnedDefault: draft.sidebar.pinned,
        hiddenItems: draft.sidebar.hidden,
      })
    );
  }, [dispatch, draft, sidebarGroupKey]);

  // Choosing a default group also switches the table to it right away, so the preview is visible.
  // It skips the first run: opening the dialog must not move the table.
  const configRef = useRef(homeTasksConfig);
  configRef.current = homeTasksConfig;
  const previousAssignedDefault = useRef(initialDraft.assignedDefault);
  useEffect(() => {
    if (previousAssignedDefault.current === draft.assignedDefault) return;
    previousAssignedDefault.current = draft.assignedDefault;
    if (draft.assignedDefault !== null && configRef.current.tasks_group_by !== draft.assignedDefault) {
      dispatch(setHomeTasksConfig({ ...configRef.current, tasks_group_by: draft.assignedDefault }));
    }
  }, [dispatch, draft.assignedDefault]);

  // If the dialog goes away without a decision (for example the page is navigated away from),
  // never leave a preview behind.
  useEffect(
    () => () => {
      dispatch(clearHomePreview());
      dispatch(clearNavPreview());
    },
    [dispatch]
  );

  const isSidebarChanged = !isSameSidebarDraft(draft.sidebar, initialDraft.sidebar);
  const isUnchanged =
    JSON.stringify([draft.layout, draft.tabs, draft.sort, draft.assignedDefault]) ===
      JSON.stringify([initialDraft.layout, initialDraft.tabs, initialDraft.sort, initialDraft.assignedDefault]) &&
    !isSidebarChanged;
  const isDefault =
    isDefaultHomeLayout(draft.layout) &&
    isDefaultHomeTabs(draft.tabs) &&
    draft.sort === null &&
    draft.assignedDefault === null &&
    isSameSidebarDraft(draft.sidebar, defaultSidebar);

  const handleSave = () => {
    dispatch(commitHomePreview());
    // Only write a sidebar order when it was edited, so an untouched sidebar keeps following the
    // registry's default order as items are added.
    dispatch(isSidebarChanged ? commitNavPreview() : clearNavPreview());
    onSave();
  };

  const handleReset = () =>
    setDraft({
      layout: DEFAULT_HOME_LAYOUT,
      tabs: DEFAULT_HOME_TABS,
      sort: null,
      assignedDefault: null,
      sidebar: defaultSidebar,
    });

  return (
    <>
      <Tabs
        size="small"
        style={{ padding: '0 24px' }}
        items={[
          {
            key: 'layout',
            label: t('customize.tabs.layout', { defaultValue: 'Layout' }),
            children: (
              <TabBody>
                <CustomizeLayoutPanel
                  layout={draft.layout}
                  onChange={layout => setDraft(prev => ({ ...prev, layout }))}
                />
              </TabBody>
            ),
          },
          {
            key: 'tabs',
            label: t('customize.tabs.taskTabs', { defaultValue: 'Task tabs' }),
            children: (
              <TabBody>
                <CustomizeTabsPanel
                  tabs={draft.tabs}
                  onChange={tabs => setDraft(prev => ({ ...prev, tabs }))}
                  assignedDefault={draft.assignedDefault}
                  onAssignedDefaultChange={assignedDefault =>
                    setDraft(prev => ({ ...prev, assignedDefault }))
                  }
                />
              </TabBody>
            ),
          },
          {
            key: 'sorting',
            label: t('customize.tabs.sorting', { defaultValue: 'Sorting' }),
            children: (
              <TabBody>
                <CustomizeSortPanel
                  sort={draft.sort}
                  onChange={sort => setDraft(prev => ({ ...prev, sort }))}
                />
              </TabBody>
            ),
          },
          {
            key: 'sidebar',
            label: t('customize.tabs.sidebar', { defaultValue: 'Left sidebar' }),
            children: (
              <TabBody>
                <CustomizeSidebarPanel
                  draft={draft.sidebar}
                  items={sidebarItems}
                  defaultKey={surface.defaultItemKey}
                  onChange={sidebar => setDraft(prev => ({ ...prev, sidebar }))}
                />
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
          title={t('customize.resetConfirm', { defaultValue: 'Reset Home to its default settings?' })}
          okText={t('customize.reset', { defaultValue: 'Reset to default' })}
          cancelText={t('customize.cancel', { defaultValue: 'Cancel' })}
          onConfirm={handleReset}
          disabled={isDefault}
        >
          <Button icon={<ReloadOutlined />} disabled={isDefault}>
            {t('customize.reset', { defaultValue: 'Reset to default' })}
          </Button>
        </Popconfirm>
        <Space>
          <Button onClick={onCancel}>{t('customize.cancel', { defaultValue: 'Cancel' })}</Button>
          <Button type="primary" onClick={handleSave} disabled={isUnchanged}>
            {t('customize.save', { defaultValue: 'Save' })}
          </Button>
        </Space>
      </Flex>
    </>
  );
};

/** Scrolls on its own so the tab bar and the Save/Cancel footer stay in view on short screens. */
const TabBody: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div style={{ maxHeight: 'min(60vh, 520px)', overflowY: 'auto', padding: '4px 4px 16px' }}>
    {children}
  </div>
);

export default CustomizeHomeModal;
