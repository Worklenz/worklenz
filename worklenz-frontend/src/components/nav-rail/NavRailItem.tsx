import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Tooltip, theme } from '@/shared/antd-imports';
import { HolderOutlined, PushpinFilled, PushpinOutlined } from '@/shared/antd-imports';
import type { NavItem } from '@/features/navigation/nav-registry.types';
import './nav-rail.css';

interface NavRailItemProps {
  item: NavItem;
  label: React.ReactNode;
  active: boolean;
  collapsed: boolean;
  isDark: boolean;
  isPinned: boolean;
  badgeValue?: number;
  draggable: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
}

// Fires `action` on Enter/Space, mirroring a native <button>'s keyboard
// behavior for the plain <span role="button"> affordances below (real
// <button> elements can't nest inside the outer item, which is itself
// interactive — nested buttons are invalid HTML).
const activateOnKey = (action: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    action();
  }
};

const NavRailItem: React.FC<NavRailItemProps> = ({
  item,
  label,
  active,
  collapsed,
  isDark,
  isPinned,
  badgeValue,
  draggable,
  onSelect,
  onTogglePin,
}) => {
  const { token } = theme.useToken();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
    disabled: !draggable,
  });

  // Matches PlannerLeftSidebar.tsx's existing fix for antd Tooltip's dark
  // chip reading as a mismatched box against a light-mode rail — reused here
  // so every surface gets the same theme-matched tooltip instead of each
  // rewriting the same workaround.
  const tooltipProps = {
    color: isDark ? undefined : '#fff',
    overlayInnerStyle: isDark ? undefined : { color: token.colorText, boxShadow: '0 2px 8px rgba(0,0,0,.15)' },
  };

  // `soon` items are non-clickable by default; `soonClickable` opts a
  // specific item (e.g. Client Portal's Ticketing) out of that while
  // keeping the dimmed styling and "Soon" tag below.
  const clickDisabled = item.soon && !item.soonClickable;

  const tooltipTitle = isPinned ? `${label} (Pinned)` : label;

  const iconColor = active ? token.colorPrimary : isDark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.45)';

  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : undefined,
  };

  // Affordances (pin, drag handle) are always in the DOM — visibility is
  // driven by CSS :hover/:focus-within (see nav-rail.css) so a keyboard user
  // tabbing to them can actually find and use them, not just a mouse user.
  const affordanceClassName = `nav-rail-affordance${isPinned ? ' nav-rail-affordance-visible' : ''}`;

  const togglePin = () => onTogglePin();

  return (
    <div ref={setNodeRef} style={wrapperStyle} className="nav-rail-item-wrapper">
      <Tooltip title={tooltipTitle} placement="right" mouseEnterDelay={0.3} mouseLeaveDelay={0} {...tooltipProps}>
        {/* A <div> with button semantics, not a real <button> — it hosts the
            pin/drag-handle affordances below, and nested <button>s inside a
            <button> are invalid HTML. */}
        <div
          role="button"
          tabIndex={clickDisabled ? -1 : 0}
          aria-disabled={clickDisabled}
          onClick={() => !clickDisabled && onSelect()}
          onKeyDown={activateOnKey(() => !clickDisabled && onSelect())}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            width: '100%',
            // Kept compact — on dense lists (e.g. Projects' 8 items, most
            // with a "Soon" badge pinned to the item's top edge) taller
            // padding pushes the centered icon/label away from that badge
            // and inflates the gap between rows, which reads worse than a
            // slightly-wide highlight.
            padding: collapsed ? '3px 2px' : '6px 4px 6px',
            cursor: clickDisabled ? 'default' : 'pointer',
            opacity: item.soon ? 0.45 : 1,
            transition: 'all .15s',
            position: 'relative',
          }}
        >
          <span
            role="button"
            tabIndex={0}
            className={affordanceClassName}
            onClick={e => {
              e.stopPropagation();
              togglePin();
            }}
            onKeyDown={e => {
              e.stopPropagation();
              activateOnKey(togglePin)(e);
            }}
            title={isPinned ? 'Pinned as default' : 'Pin as default view'}
            style={{
              position: 'absolute',
              top: 4,
              left: 4,
              width: 16,
              height: 16,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isPinned ? token.colorPrimaryBg : isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)',
              zIndex: 2,
              cursor: 'pointer',
            }}
          >
            {isPinned ? (
              <PushpinFilled style={{ fontSize: 9, color: token.colorPrimary }} />
            ) : (
              <PushpinOutlined style={{ fontSize: 9, color: isDark ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.45)' }} />
            )}
          </span>

          {typeof badgeValue === 'number' && badgeValue > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 5,
                right: 7,
                minWidth: 15,
                height: 15,
                borderRadius: 8,
                background: '#ff4d4f',
                color: '#fff',
                fontSize: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                padding: '0 3px',
                zIndex: 2,
              }}
            >
              {badgeValue > 99 ? '99+' : badgeValue}
            </span>
          )}

          {item.soon && (
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                fontSize: 8,
                background: 'rgba(250,173,20,.15)',
                color: '#d46b08',
                borderRadius: 3,
                padding: '1px 4px',
                fontWeight: 600,
              }}
            >
              Soon
            </span>
          )}

          {/* No background fill for the active state — just the icon/label
              color change below (iconColor already swaps to colorPrimary
              when active). */}
          <span
            style={{
              width: 24,
              height: 24,
              fontSize: 24,
              color: iconColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color .15s',
            }}
          >
            {item.icon}
          </span>

          {!collapsed && (
            <span
              style={{
                fontSize: 11,
                fontWeight: active ? 600 : 500,
                textAlign: 'center',
                lineHeight: 1.2,
                color: iconColor,
                whiteSpace: 'pre-line',
                transition: 'color .15s',
              }}
            >
              {label}
            </span>
          )}

          {draggable && (
            <span
              className="nav-rail-affordance"
              {...attributes}
              {...listeners}
              onClick={e => e.stopPropagation()}
              onKeyDown={e => {
                // dnd-kit's own activation handler (Space/Enter) calls
                // preventDefault but not stopPropagation — without this, the
                // key event would also bubble up and trigger onSelect on the
                // outer item, navigating away at the same moment a keyboard
                // drag starts.
                listeners?.onKeyDown?.(e);
                if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
              }}
              aria-label={`Reorder ${typeof label === 'string' ? label : item.key}`}
              style={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                fontSize: 10,
                color: isDark ? 'rgba(255,255,255,.4)' : 'rgba(0,0,0,.35)',
                cursor: 'grab',
                display: 'flex',
                zIndex: 2,
              }}
            >
              <HolderOutlined />
            </span>
          )}
        </div>
      </Tooltip>
    </div>
  );
};

export default NavRailItem;
