import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { theme } from '@/shared/antd-imports';

export interface DocsSuggestionItem {
  id: string;
  label: string;
  group?: string;
  detail?: string;
  kind?: 'member' | 'task' | 'block';
  entityId?: string;
}

interface MenuState {
  items: DocsSuggestionItem[];
  selected: number;
  top: number;
  left: number;
  command: (item: DocsSuggestionItem) => void;
}

export interface DocsSuggestionMenuHandle {
  open: (state: Omit<MenuState, 'selected'>) => void;
  update: (state: Omit<MenuState, 'selected'>) => void;
  close: () => void;
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface DocsSuggestionMenuProps {
  ariaLabel: string;
  emptyLabel?: string;
  onDismiss?: () => void;
  onActiveOption?: (optionId: string | null, menuId: string | null) => void;
}

export const DocsSuggestionMenu = forwardRef<DocsSuggestionMenuHandle, DocsSuggestionMenuProps>(
  ({ ariaLabel, emptyLabel, onDismiss, onActiveOption }, ref) => {
    const { token } = theme.useToken();
    const [menu, setMenu] = useState<MenuState | null>(null);
    const menuRef = useRef<MenuState | null>(null);
    const elementRef = useRef<HTMLDivElement>(null);
    const menuId = useId();

    useEffect(() => {
      const optionId = menu?.items.length ? `${menuId}-${menu.selected}` : null;
      onActiveOption?.(optionId, menu ? menuId : null);
      if (optionId) document.getElementById(optionId)?.scrollIntoView?.({ block: 'nearest' });
      return () => onActiveOption?.(null, null);
    }, [menu, menuId, onActiveOption]);

    useEffect(() => {
      if (!menu || !onDismiss) return;
      const dismiss = (event: PointerEvent) => {
        if (event.target instanceof Node && !elementRef.current?.contains(event.target)) {
          commitMenu(null);
          onDismiss();
        }
      };
      document.addEventListener('pointerdown', dismiss);
      return () => document.removeEventListener('pointerdown', dismiss);
    }, [!!menu, onDismiss]);

    const commitMenu = (next: MenuState | null) => {
      menuRef.current = next;
      setMenu(next);
    };

    useImperativeHandle(ref, () => ({
      open: state => commitMenu({ ...state, selected: 0 }),
      update: state => {
        const current = menuRef.current;
        commitMenu({
          ...state,
          selected: Math.min(current?.selected || 0, Math.max(state.items.length - 1, 0)),
        });
      },
      close: () => commitMenu(null),
      onKeyDown: event => {
        const current = menuRef.current;
        if (!current || event.isComposing) return false;
        if (event.key === 'Escape') {
          commitMenu(null);
          onDismiss?.();
          return true;
        }
        if (current.items.length === 0)
          return !!emptyLabel && ['Enter', 'ArrowUp', 'ArrowDown'].includes(event.key);
        if (event.key === 'ArrowDown') {
          commitMenu({ ...current, selected: (current.selected + 1) % current.items.length });
          return true;
        }
        if (event.key === 'ArrowUp') {
          commitMenu({
            ...current,
            selected: (current.selected - 1 + current.items.length) % current.items.length,
          });
          return true;
        }
        if (event.key === 'Enter') {
          const item = current.items[current.selected];
          if (item) current.command(item);
          return true;
        }
        return false;
      },
    }));

    if (!menu || (!menu.items.length && !emptyLabel)) return null;

    let previousGroup = '';

    return (
      <div
        ref={elementRef}
        id={menuId}
        role="listbox"
        aria-label={ariaLabel}
        className="fixed z-[80] max-h-64 w-72 overflow-auto rounded-md border py-1 shadow-lg"
        style={{
          top: menu.top,
          left: menu.left,
          background: token.colorBgElevated,
          borderColor: token.colorBorderSecondary,
          color: token.colorText,
        }}
      >
        {!menu.items.length ? (
          <div
            role="status"
            className="px-3 py-2 text-sm"
            style={{ color: token.colorTextSecondary }}
          >
            {emptyLabel}
          </div>
        ) : null}
        {menu.items.map((item, index) => {
          const showGroup = item.group && item.group !== previousGroup;
          if (item.group) previousGroup = item.group;
          const selected = index === menu.selected;
          return (
            <div key={`${item.group || 'item'}-${item.id}`}>
              {showGroup ? (
                <div
                  className="px-3 pb-1 pt-2 text-xs font-medium"
                  style={{ color: token.colorTextSecondary }}
                >
                  {item.group}
                </div>
              ) : null}
              <button
                type="button"
                id={`${menuId}-${index}`}
                role="option"
                aria-selected={selected}
                className="mx-1 flex w-[calc(100%-8px)] items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-sm"
                style={{
                  background: selected ? token.colorFillSecondary : 'transparent',
                  color: token.colorText,
                }}
                onMouseEnter={() => {
                  if (!menuRef.current) return;
                  commitMenu({ ...menuRef.current, selected: index });
                }}
                onMouseDown={event => {
                  event.preventDefault();
                }}
                onClick={() => {
                  menu.command(item);
                }}
              >
                <span className="truncate">{item.label}</span>
                {item.detail ? (
                  <span className="shrink-0 text-xs" style={{ color: token.colorTextSecondary }}>
                    {item.detail}
                  </span>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>
    );
  }
);

DocsSuggestionMenu.displayName = 'DocsSuggestionMenu';

export const suggestionPosition = (clientRect: (() => DOMRect | null) | null | undefined) => {
  const rect = clientRect?.();
  const top = (rect?.bottom || 0) + 6;
  const left = Math.min(rect?.left || 0, window.innerWidth - 300);
  return {
    top: top > window.innerHeight - 180 ? Math.max((rect?.top || 0) - 200, 8) : top,
    left: Math.max(8, left),
  };
};
