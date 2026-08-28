import React, { useMemo } from 'react';
import { shallowEqual } from 'react-redux';
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import type { NavItem, ResolvedNavState } from '@/features/navigation/nav-registry.types';
import NavRailItem from './NavRailItem';

interface NavRailProps {
  resolved: ResolvedNavState;
  activeKey: string;
  isDark: boolean;
  onSelect: (key: string) => void;
  isPinned: (itemKey: string) => boolean;
  onPin: (itemKey: string) => void;
  onUnpin: () => void;
  onReorder: (groupKey: string, order: string[]) => void;
  onToggleCollapse: () => void;
  renderLabel?: (item: NavItem) => React.ReactNode;
  renderGroupLabel?: (label: NavItem['label']) => React.ReactNode;
}

const defaultRenderLabel = (item: NavItem): React.ReactNode =>
  typeof item.label === 'string' ? item.label : item.label.defaultValue;

const defaultRenderGroupLabel = (label: NavItem['label']): React.ReactNode =>
  typeof label === 'string' ? label : label.defaultValue;

// The one template every left rail (Home, Planner, Reporting, Client Portal)
// mounts for its item list — collapse, themed tooltip, pin-as-default, and
// drag-to-reorder live here exactly once instead of once per page.
const NavRail: React.FC<NavRailProps> = ({
  resolved,
  activeKey,
  isDark,
  onSelect,
  isPinned,
  onPin,
  onUnpin,
  onReorder,
  onToggleCollapse,
  renderLabel = defaultRenderLabel,
  renderGroupLabel = defaultRenderGroupLabel,
}) => {
  const { groups, collapsed } = resolved;

  const badgeValues = useAppSelector(state => {
    const values: Record<string, number> = {};
    for (const group of groups) {
      for (const item of group.items) {
        if (item.badgeSelector) values[item.key] = item.badgeSelector(state);
      }
    }
    return values;
  }, shallowEqual);

  const groupKeyByItemKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groups) {
      for (const item of group.items) map.set(item.key, group.key);
    }
    return map;
  }, [groups]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeGroupKey = groupKeyByItemKey.get(active.id as string);
    const overGroupKey = groupKeyByItemKey.get(over.id as string);
    // Different group (or an unrecognized drop target) — reject silently;
    // not calling onReorder leaves the saved order untouched, so the item
    // snaps back to its original position. Group keys are often '' (the
    // default, ungrouped bucket used by every surface but Reporting), so
    // this must check for a missing map entry specifically, not falsiness.
    if (activeGroupKey === undefined || activeGroupKey !== overGroupKey) return;

    const group = groups.find(g => g.key === activeGroupKey);
    if (!group) return;

    const orderedKeys = group.items.filter(item => !item.lockedOrder).map(item => item.key);
    const oldIndex = orderedKeys.indexOf(active.id as string);
    const newIndex = orderedKeys.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(activeGroupKey, arrayMove(orderedKeys, oldIndex, newIndex));
  };

  const handleTogglePin = (itemKey: string) => {
    if (isPinned(itemKey)) onUnpin();
    else onPin(itemKey);
  };

  // Spacing unit for the gap between items themselves.
  const RAIL_ITEM_GAP = 12;
  // Toggle-to-first-item gap is intentionally larger (~3x a single item's
  // own vertical padding) so the collapse control reads as separate from
  // the nav items below it, rather than the tight item-to-item rhythm.
  const RAIL_TOGGLE_BOTTOM_GAP = 12;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: `${RAIL_ITEM_GAP}px 8px ${RAIL_TOGGLE_BOTTOM_GAP}px`, display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand' : 'Collapse'}
          style={{
            border: 'none',
            background: 'transparent',
            padding: 0,
            fontSize: 17,
            color: isDark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.45)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: RAIL_ITEM_GAP,
            paddingTop: RAIL_ITEM_GAP,
          }}
        >
          {groups.map((group, groupIndex) => {
            const sortableIds = group.items.filter(item => !item.lockedOrder).map(item => item.key);
            return (
              <React.Fragment key={group.key || `group-${groupIndex}`}>
                {groupIndex > 0 && (
                  <div style={{ margin: '6px auto', width: 'calc(100% - 16px)' }}>
                    {!collapsed && group.label && (
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: 0.4,
                          textTransform: 'uppercase',
                          color: isDark ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.35)',
                          padding: '6px 4px 4px',
                        }}
                      >
                        {renderGroupLabel(group.label)}
                      </div>
                    )}
                    <div style={{ height: 1, background: isDark ? '#303030' : '#e8e8e8' }} />
                  </div>
                )}
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  {group.items.map(item => (
                    <NavRailItem
                      key={item.key}
                      item={item}
                      label={renderLabel(item)}
                      active={activeKey === item.key}
                      collapsed={collapsed}
                      isDark={isDark}
                      isPinned={isPinned(item.key)}
                      badgeValue={badgeValues[item.key]}
                      draggable={!item.lockedOrder}
                      onSelect={() => onSelect(item.key)}
                      onTogglePin={() => handleTogglePin(item.key)}
                    />
                  ))}
                </SortableContext>
              </React.Fragment>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
};

export default NavRail;
