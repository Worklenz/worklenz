import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Button, Popover, theme, PlusOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import {
  getAddableWidgets,
  HOME_GREETING_ID,
  isGreetingVisible,
  type HomeLayout,
  type HomeSectionId,
} from '../home-layout/homeLayout';
import { GripIcon } from './HomeWidgetShell';
import { useHomeWidgetDnd } from './HomeWidgetDnd';
import { HOME_GREETING_ICON, HOME_WIDGET_ICONS } from './widgetIcons';
import { toMenuDragId, WIDGET_DRAG_SOURCE_ATTRIBUTE } from './widgetInteraction';

interface AddWidgetButtonProps {
  layout: HomeLayout;
  onAdd: (id: HomeSectionId) => void;
  /** Whether a row can be dragged onto the page. Off on small screens, where the page is one column. */
  isDragEnabled?: boolean;
  /** `toolbar`: the button above the widgets. `empty-state`: the one on the empty page, labelled "Add widgets". */
  variant?: 'toolbar' | 'empty-state';
}

interface AddOption {
  id: HomeSectionId;
  title: string;
  description: string;
  icon: React.ReactNode;
}

/**
 * "Add widget": a panel listing everything that is not on the page right now, the greeting banner
 * included once it has been removed. A widget is only added on purpose: by pressing its Add button,
 * or by dragging it onto the page to add it exactly where it is dropped. Clicking its name or
 * description does nothing, so the panel can be read and scrolled without adding anything by accident.
 */
export const AddWidgetButton: React.FC<AddWidgetButtonProps> = ({
  layout,
  onAdd,
  isDragEnabled = false,
  variant = 'toolbar',
}) => {
  const { t } = useTranslation('home');
  const { dragging } = useHomeWidgetDnd();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // While a row is being dragged the panel steps out of the way, so the page underneath is in plain
  // view, but stays laid out (it is the thing being dragged from). It closes once dropped.
  const isMenuDragging = dragging?.source === 'menu';
  const wasMenuDragging = useRef(false);
  useEffect(() => {
    if (wasMenuDragging.current && !isMenuDragging) setIsOpen(false);
    wasMenuDragging.current = isMenuDragging;
  }, [isMenuDragging]);

  const options = useMemo<AddOption[]>(
    () => [
      // The banner sits at the top of the page, so it heads the list.
      ...(isGreetingVisible(layout)
        ? []
        : [
            {
              id: HOME_GREETING_ID,
              title: t('customize.widgets.greeting', { defaultValue: 'Greeting banner' }),
              description: t('widgets.descriptions.greeting', {
                defaultValue: "A hello with today's date and what needs your attention.",
              }),
              icon: HOME_GREETING_ICON,
            } satisfies AddOption,
          ]),
      ...getAddableWidgets(layout).map(widget => ({
        id: widget.id,
        title: t(widget.titleKey, { defaultValue: widget.titleDefault }),
        description: t(widget.descriptionKey, { defaultValue: widget.descriptionDefault }),
        icon: HOME_WIDGET_ICONS[widget.id],
      })),
    ],
    [layout, t]
  );

  // The panel is portalled to the end of the page, so keyboard focus has to be carried into it when it
  // opens and back to the button when it closes, or it would be unreachable by keyboard.
  const focusTrigger = useCallback(() => triggerRef.current?.focus({ preventScroll: true }), []);

  const handleAdd = useCallback(
    (id: HomeSectionId) => {
      onAdd(id);
      setIsOpen(false);
      focusTrigger();
    },
    [onAdd, focusTrigger]
  );

  const handlePanelKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    setIsOpen(false);
    focusTrigger();
  };

  // The greeting banner is placed at the top of the page, never dragged.
  const hasDraggableOption = isDragEnabled && options.some(option => option.id !== HOME_GREETING_ID);

  const panel = (
    <div
      ref={panelRef}
      role="group"
      aria-label={t('widgets.add.button', { defaultValue: 'Add widget' })}
      onKeyDown={handlePanelKeyDown}
      style={{ width: 340, maxWidth: 'calc(100vw - 48px)' }}
    >
      {options.length === 0 ? (
        <PanelText>{t('widgets.add.empty', { defaultValue: 'Every widget is already on your Home page.' })}</PanelText>
      ) : (
        <>
          {/* Dragging is not something a button announces by itself, so say so. */}
          {hasDraggableOption && (
            <PanelText>
              {t('widgets.add.hint', { defaultValue: 'Press Add, or drag a widget onto your page.' })}
            </PanelText>
          )}
          <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {options.map(option => (
              <AddWidgetRow
                key={option.id}
                option={option}
                isDraggable={isDragEnabled && option.id !== HOME_GREETING_ID}
                onAdd={handleAdd}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <Popover
      open={isOpen}
      onOpenChange={setIsOpen}
      afterOpenChange={isNowOpen => {
        if (isNowOpen) panelRef.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
      }}
      content={panel}
      trigger="click"
      placement={variant === 'toolbar' ? 'bottomRight' : 'bottom'}
      arrow={false}
      // Only one panel's rows exist at a time: the page can have this button twice (toolbar and
      // empty state), and a row's drag id must not be registered by both.
      destroyOnHidden
      styles={{
        // Faded rather than unmounted while a row is dragged out of it, so the drag keeps its source.
        root: isMenuDragging ? { opacity: 0, pointerEvents: 'none' } : undefined,
        body: { padding: 8 },
      }}
    >
      {/* The same size as the one on the empty page: antd's default button. The icon is decorative:
          hidden from assistive tech so it doesn't read as "plus Add widget". */}
      {variant === 'toolbar' ? (
        <Button ref={triggerRef} icon={<PlusOutlined aria-hidden />} aria-expanded={isOpen}>
          {t('widgets.add.button', { defaultValue: 'Add widget' })}
        </Button>
      ) : (
        <Button ref={triggerRef} icon={<PlusOutlined aria-hidden />} aria-expanded={isOpen}>
          {t('widgets.empty.button', { defaultValue: 'Add widgets' })}
        </Button>
      )}
    </Popover>
  );
};

const PanelText: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = theme.useToken();
  return <div style={{ padding: '4px 8px 8px', fontSize: 12, color: token.colorTextSecondary }}>{children}</div>;
};

interface AddWidgetRowProps {
  option: AddOption;
  isDraggable: boolean;
  onAdd: (id: HomeSectionId) => void;
}

/**
 * One widget that can be added. Its description (the part that is not a button) is the drag handle,
 * so it can be picked up from anywhere on it; the Add button sits beside it, outside the handle,
 * and is the only thing that adds on a click.
 */
const AddWidgetRow: React.FC<AddWidgetRowProps> = ({ option, isDraggable, onAdd }) => {
  const { t } = useTranslation('home');
  const { token } = theme.useToken();
  const { setNodeRef, listeners } = useDraggable({ id: toMenuDragId(option.id), disabled: !isDraggable });

  return (
    <div
      role="listitem"
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: token.borderRadius }}
    >
      <div
        ref={setNodeRef}
        {...listeners}
        {...(isDraggable ? { [WIDGET_DRAG_SOURCE_ATTRIBUTE]: '' } : {})}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          flex: 1,
          minWidth: 0,
          cursor: isDraggable ? 'grab' : 'default',
        }}
      >
        <span aria-hidden style={{ display: 'flex', paddingTop: 4, color: token.colorTextSecondary }}>
          {option.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500 }}>{option.title}</div>
          <div style={{ fontSize: 12, lineHeight: 1.4, color: token.colorTextSecondary }}>{option.description}</div>
        </div>
        {isDraggable && (
          <span aria-hidden style={{ display: 'flex', paddingTop: 6, color: token.colorTextQuaternary }}>
            <GripIcon />
          </span>
        )}
      </div>
      <Button
        size="small"
        color="primary"
        variant="outlined"
        onClick={() => onAdd(option.id)}
        aria-label={t('widgets.add.addNamed', { defaultValue: 'Add {{name}}', name: option.title })}
        style={{ flexShrink: 0 }}
      >
        {t('widgets.add.addAction', { defaultValue: 'Add' })}
      </Button>
    </div>
  );
};
