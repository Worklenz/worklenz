import React from 'react';
import { Flex, Typography } from '@/shared/antd-imports';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { CustomizeAssignedPanel } from './CustomizeAssignedPanel';
import { SortableCustomizeRow } from './CustomizeRow';
import type { HomeAssignedGroup } from '@/features/home-page/homePreferences.slice';
import {
  getHomeTabDefinition,
  getVisibleTabs,
  isHomePriorityTab,
  moveTabToIndex,
  setTabHidden,
  shiftTab,
  type HomeTabsConfig,
} from './homeTabs';

interface CustomizeTabsPanelProps {
  tabs: HomeTabsConfig;
  onChange: (tabs: HomeTabsConfig) => void;
  /**
   * The group the table opens on (null = whichever was used last), shown above the tab list when
   * both it and its setter are given. Left out where that choice has a place of its own.
   */
  assignedDefault?: HomeAssignedGroup | null;
  onAssignedDefaultChange?: (group: HomeAssignedGroup | null) => void;
}

export const CustomizeTabsPanel: React.FC<CustomizeTabsPanelProps> = ({
  tabs,
  onChange,
  assignedDefault,
  onAssignedDefaultChange,
}) => {
  const { t } = useTranslation('home');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    if (!isHomePriorityTab(active.id) || !isHomePriorityTab(over.id)) return;
    onChange(moveTabToIndex(tabs, active.id, tabs.order.indexOf(over.id)));
  };

  const isOnlyVisibleTab = (id: string) => {
    const visible = getVisibleTabs(tabs);
    return visible.length === 1 && visible[0] === id;
  };

  return (
    <Flex vertical gap={16}>
      {assignedDefault !== undefined && onAssignedDefaultChange && (
        <CustomizeAssignedPanel assignedDefault={assignedDefault} onChange={onAssignedDefaultChange} />
      )}

      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        {t('customize.tabsDescription', {
          defaultValue:
            'Choose which tabs appear above the task table and the order they appear in. At least one tab must stay on.',
        })}
      </Typography.Paragraph>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tabs.order} strategy={verticalListSortingStrategy}>
          <Flex vertical gap={8}>
            {tabs.order.map((id, index) => {
              const { labelKey, labelDefault } = getHomeTabDefinition(id);
              return (
                <SortableCustomizeRow
                  key={id}
                  id={id}
                  title={t(labelKey, { defaultValue: labelDefault })}
                  isVisible={!tabs.hidden.includes(id)}
                  canHide={!isOnlyVisibleTab(id)}
                  lockedReason={t('customize.cannotHideLastTab', {
                    defaultValue: 'At least one tab must stay visible.',
                  })}
                  onVisibleChange={visible => onChange(setTabHidden(tabs, id, !visible))}
                  reorder={{
                    isFirst: index === 0,
                    isLast: index === tabs.order.length - 1,
                    onMoveUp: () => onChange(shiftTab(tabs, id, -1)),
                    onMoveDown: () => onChange(shiftTab(tabs, id, 1)),
                  }}
                />
              );
            })}
          </Flex>
        </SortableContext>
      </DndContext>
    </Flex>
  );
};
