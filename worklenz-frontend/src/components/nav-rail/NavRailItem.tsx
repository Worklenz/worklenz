import React, { useMemo, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Tooltip, theme } from '@/shared/antd-imports';
import { PushpinFilled, PushpinOutlined } from '@/shared/antd-imports';
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
// behavior for the plain <span role="button"> affordances below.
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

  const clickDisabled = item.soon && !item.soonClickable;

  const tooltipTitle = isPinned ? `${label} (Pinned)` : label;
  const iconColor = active
    ? token.colorPrimary
    : isDark
      ? 'rgba(255,255,255,.45)'
      : 'rgba(0,0,0,.45)';

  // ─── Memoized styles ────────────────────────────────────────────────────────

  const wrapperStyle = useMemo(
    () => ({
      position: 'relative' as const,
      width: '100%',
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      zIndex: isDragging ? 1 : undefined,
      // Pass token colors to CSS for pure-CSS hover glow (zero JS re-renders on hover)
      '--nav-rail-color-primary': token.colorPrimary,
      '--nav-rail-glow': token.colorPrimary,
    } as React.CSSProperties),
    [transform, transition, isDragging, token.colorPrimary],
  );

  const buttonStyle = useMemo(
    () => ({
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      width: '100%',
      padding: collapsed ? '3px 2px' : '6px 4px 6px',
      cursor: clickDisabled ? 'default' : 'pointer',
      opacity: item.soon ? 0.45 : 1,
      position: 'relative' as const,
      background: 'transparent',
    }),
    [collapsed, clickDisabled, item.soon],
  );

  // Pin icon colour: primary when already pinned, muted otherwise.
  // The :hover glow and color are handled in CSS without re-renders.
  const pinIconColor = useMemo(
    () => (isPinned ? token.colorPrimary : isDark ? 'rgba(255,255,255,.40)' : 'rgba(0,0,0,.35)'),
    [isPinned, isDark, token.colorPrimary],
  );

  const pinIconStyle = useMemo(
    () => ({
      fontSize: 10,
      color: pinIconColor,
      transition: 'color .15s',
    }),
    [pinIconColor],
  );

  const pinWrapperStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      // Top-left corner — clear of badge (top-right) and Soon tag (right side)
      top: 4,
      left: 4,
      width: 16,
      height: 16,
      borderRadius: token.borderRadiusSM,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3,
      cursor: 'pointer',
    }),
    [token.borderRadiusSM],
  );

  const tooltipProps = useMemo(
    () => ({
      color: isDark ? undefined : '#fff',
      styles: {
        body: isDark ? undefined : { color: token.colorText, boxShadow: '0 2px 8px rgba(0,0,0,.15)' },
      },
    }),
    [isDark, token.colorText],
  );

  // ─── Stable callbacks ────────────────────────────────────────────────────────

  const handleSelect = useCallback(() => {
    if (!clickDisabled) onSelect();
  }, [clickDisabled, onSelect]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // First invoke dnd-kit's onKeyDown listener if present
      listeners?.onKeyDown?.(e);

      // If dnd-kit handled the key (e.g. Space to initiate keyboard drag), don't trigger selection
      if (e.isDefaultPrevented() || e.defaultPrevented) {
        return;
      }

      // Keyboard activation for selection on Enter or Space
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelect();
      }
    },
    [listeners, handleSelect],
  );

  // Pin click: stop propagation so surrounding elements don't trigger.
  const handlePinClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onTogglePin();
    },
    [onTogglePin],
  );

  const handlePinKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      activateOnKey(onTogglePin)(e);
    },
    [onTogglePin],
  );

  // Intercept DnD pointer events on the pin so they don't start a drag.
  const handlePinPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div ref={setNodeRef} style={wrapperStyle} className="nav-rail-item-wrapper">
      {/* ── Pin affordance (top-left, visible when active/pinned or hovered) ──
          Positioned as a sibling outside the interactive sortable item to avoid
          nested interactive controls while remaining independently keyboard-accessible. */}
      <span
        role="button"
        tabIndex={0}
        aria-label={isPinned ? 'Unpin this view' : 'Pin as default view'}
        title={isPinned ? 'Pinned as default' : 'Pin as default view'}
        className={`nav-rail-pin-affordance ${active || isPinned ? 'nav-rail-pin-visible' : ''}`}
        onClick={handlePinClick}
        onKeyDown={handlePinKeyDown}
        onPointerDown={handlePinPointerDown}
        style={pinWrapperStyle}
      >
        {isPinned ? (
          <PushpinFilled style={pinIconStyle} />
        ) : (
          <PushpinOutlined style={pinIconStyle} />
        )}
      </span>

      <Tooltip
        title={tooltipTitle}
        placement="right"
        mouseEnterDelay={0.3}
        mouseLeaveDelay={0}
        {...tooltipProps}
      >
        <div
          {...attributes}
          {...listeners}
          tabIndex={clickDisabled ? -1 : 0}
          aria-disabled={clickDisabled}
          onClick={handleSelect}
          onKeyDown={handleKeyDown}
          style={buttonStyle}
        >
          {/* ── Unread badge ───────────────────────────────────────────────── */}
          {typeof badgeValue === 'number' && badgeValue > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: 5,
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
                pointerEvents: 'none',
              }}
            >
              {badgeValue > 99 ? '99+' : badgeValue}
            </span>
          )}

          {/* ── Soon tag ───────────────────────────────────────────────────── */}
          {item.soon && (
            <span
              style={{
                position: 'absolute',
                top: 22,
                right: 4,
                fontSize: 8,
                background: 'rgba(250,173,20,.15)',
                color: '#d46b08',
                borderRadius: token.borderRadiusSM,
                padding: '1px 4px',
                fontWeight: 600,
                zIndex: 2,
                pointerEvents: 'none',
              }}
            >
              Soon
            </span>
          )}

          {/* ── Nav icon (glows on hover via CSS drop-shadow, no background box) ── */}
          <span
            className="nav-rail-item-icon"
            style={{
              color: iconColor,
            }}
          >
            {item.icon}
          </span>

          {/* ── Label ─────────────────────────────────────────────────────── */}
          {!collapsed && (
            <span
              className="nav-rail-item-label"
              style={{
                fontWeight: active ? 600 : 500,
                color: iconColor,
              }}
            >
              {label}
            </span>
          )}
        </div>
      </Tooltip>
    </div>
  );
};

export default React.memo(NavRailItem);
