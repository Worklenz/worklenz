import React from 'react';
import {
  Button,
  Flex,
  Tooltip,
  Typography,
  theme,
  PushpinFilled,
  PushpinOutlined,
} from '@/shared/antd-imports';
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
import { SortableCustomizeRow } from './CustomizeRow';
import {
  canHideSidebarItem,
  getLandingKey,
  moveSidebarItem,
  setSidebarItemHidden,
  shiftSidebarItem,
  togglePinnedSidebarItem,
  type HomeSidebarDraft,
} from './homeSidebar';
import type { NavItem } from '@/features/navigation/nav-registry.types';

interface CustomizeSidebarPanelProps {
  draft: HomeSidebarDraft;
  /** Every sidebar item this user may see, hidden ones included, keyed by item key. */
  items: Map<string, NavItem>;
  /** The page Home opens on when nothing is pinned. */
  defaultKey: string;
  onChange: (draft: HomeSidebarDraft) => void;
}

export const CustomizeSidebarPanel: React.FC<CustomizeSidebarPanelProps> = ({
  draft,
  items,
  defaultKey,
  onChange,
}) => {
  const { t } = useTranslation('home');
  // Item labels live in the sidebar's own namespace.
  const { t: tSidebar } = useTranslation('home-sidebar');
  const { token } = theme.useToken();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const labelOf = (item: NavItem): string => {
    const label =
      typeof item.label === 'string'
        ? item.label
        : tSidebar(item.label.i18nKey, { defaultValue: item.label.defaultValue });
    // Some labels contain a line break to fit the narrow rail; the dialog has room for one line.
    return label.replace(/\s*\n\s*/g, ' ');
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const overIndex = draft.order.indexOf(String(over.id));
    if (overIndex === -1) return;
    onChange(moveSidebarItem(draft, String(active.id), overIndex));
  };

  const keys = draft.order.filter(key => items.has(key));

  return (
    <Flex vertical gap={16}>
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        {t('customize.sidebarDescription', {
          defaultValue:
            'Reorder the items in the left sidebar and choose which ones show. Pin one to make it the page that opens when you go to Home.',
        })}
      </Typography.Paragraph>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={keys} strategy={verticalListSortingStrategy}>
          <Flex vertical gap={8}>
            {keys.map((key, index) => {
              const item = items.get(key) as NavItem;
              const title = labelOf(item);
              const isPinned = draft.pinned === key;
              const canHide = canHideSidebarItem(draft, key, defaultKey);
              const lockedReason =
                key === getLandingKey(draft, defaultKey)
                  ? t('customize.cannotHideLanding', {
                      defaultValue: 'Home opens on this page. Pin another page to hide it.',
                    })
                  : t('customize.cannotHideLastItem', {
                      defaultValue: 'At least one item must stay visible.',
                    });
              const pinLabel = isPinned
                ? t('customize.unpinSidebarItem', { defaultValue: 'Unpin {{name}}', name: title })
                : t('customize.pinSidebarItem', {
                    defaultValue: 'Pin {{name}} as the page that opens first',
                    name: title,
                  });
              return (
                <SortableCustomizeRow
                  key={key}
                  id={key}
                  title={title}
                  icon={item.icon}
                  isVisible={!draft.hidden.includes(key)}
                  canHide={canHide}
                  lockedReason={lockedReason}
                  onVisibleChange={visible =>
                    onChange(setSidebarItemHidden(draft, key, !visible, defaultKey))
                  }
                  reorder={{
                    isFirst: index === 0,
                    isLast: index === keys.length - 1,
                    onMoveUp: () => onChange(shiftSidebarItem(draft, key, -1)),
                    onMoveDown: () => onChange(shiftSidebarItem(draft, key, 1)),
                  }}
                  extraActions={
                    <Tooltip title={pinLabel}>
                      <Button
                        type="text"
                        size="small"
                        aria-pressed={isPinned}
                        aria-label={pinLabel}
                        icon={
                          isPinned ? (
                            <PushpinFilled style={{ color: token.colorPrimary }} />
                          ) : (
                            <PushpinOutlined />
                          )
                        }
                        onClick={() => onChange(togglePinnedSidebarItem(draft, key))}
                      />
                    </Tooltip>
                  }
                />
              );
            })}
          </Flex>
        </SortableContext>
      </DndContext>
    </Flex>
  );
};
