import React, { useMemo, useRef, useState } from 'react';
import {
  Button,
  Dropdown,
  theme,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  DeleteOutlined,
  MoreOutlined,
  type MenuProps,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useHomeWidget } from './HomeWidgetContext';
import './home-widgets.css';

type MenuItems = NonNullable<MenuProps['items']>;

interface HomeWidgetMenuButtonProps {
  /**
   * For a widget with no header to hold the button: it floats in the top-right corner and only
   * shows while the widget is hovered or focused.
   */
  isFloating?: boolean;
  /** Entries of the widget's own, listed first and set apart from the ones every widget has. */
  extraItems?: MenuProps['items'];
  /** Keys of `extraItems` that leave the menu open when picked, for a run of toggles. */
  keepOpenKeys?: ReadonlySet<string>;
}

/** Wraps the click of every item whose key is in `keys`, so the menu can tell it was one of them. */
const onKeepOpenClick = (items: MenuItems, keys: ReadonlySet<string>, mark: () => void): MenuItems =>
  items.map(item => {
    if (!item) return item;
    // A group has no key of its own, so look inside it before looking for a key.
    if ('children' in item && Array.isArray(item.children)) {
      return { ...item, children: onKeepOpenClick(item.children as MenuItems, keys, mark) } as MenuItems[number];
    }
    if (!('key' in item) || !keys.has(String(item.key))) return item;
    const original = (item as { onClick?: MenuProps['onClick'] }).onClick;
    return {
      ...item,
      onClick: info => {
        mark();
        original?.(info);
      },
    } as MenuItems[number];
  });

/**
 * The "..." button of a widget (three dots, stacked): the widget's own entries if it has any, then
 * send it to the other column, then remove it.
 */
export const HomeWidgetMenuButton: React.FC<HomeWidgetMenuButtonProps> = ({
  isFloating = false,
  extraItems,
  keepOpenKeys,
}) => {
  const widget = useHomeWidget();
  const { t } = useTranslation('home');
  const { token } = theme.useToken();
  const [isOpen, setIsOpen] = useState(false);
  // Set by an item that wants the menu to stay open; read (and cleared) when the menu then asks to close.
  const isKeepingOpen = useRef(false);

  const items = useMemo<MenuProps['items']>(() => {
    if (!widget) return [];
    const { actions } = widget;
    const moveToOther =
      actions.otherColumn === 'side'
        ? { label: t('customize.moveToSide', { defaultValue: 'Move to side panel' }), icon: <ArrowRightOutlined aria-hidden /> }
        : { label: t('customize.moveToMain', { defaultValue: 'Move to main area' }), icon: <ArrowLeftOutlined aria-hidden /> };

    const own: MenuItems = extraItems?.length
      ? keepOpenKeys
        ? onKeepOpenClick(extraItems, keepOpenKeys, () => (isKeepingOpen.current = true))
        : extraItems
      : [];

    return [
      // Each group is set apart from the next by a divider, and only when there is a next one.
      ...(own.length ? [...own, { type: 'divider' as const }] : []),
      ...(actions.otherColumn
        ? [
            { key: 'column', ...moveToOther, onClick: actions.onMoveToOtherColumn },
            { type: 'divider' as const },
          ]
        : []),
      {
        key: 'remove',
        icon: <DeleteOutlined aria-hidden />,
        // Removing is the one destructive entry, so it reads as one (red). It can be added back.
        danger: true,
        label: t('widgets.menu.remove', { defaultValue: 'Remove widget' }),
        disabled: !actions.canRemove,
        title: actions.canRemove ? undefined : t('customize.cannotHide', { defaultValue: "This section can't be hidden." }),
        onClick: actions.onRemove,
      },
    ];
  }, [widget, extraItems, keepOpenKeys, t]);

  // Outside the Home overview there is nothing to move or remove.
  if (!widget) return null;

  return (
    <Dropdown
      open={isOpen}
      onOpenChange={(next, info) => {
        // Picking an item normally closes the menu; the ones that keep it open say so first.
        if (!next && info.source === 'menu' && isKeepingOpen.current) {
          isKeepingOpen.current = false;
          return;
        }
        isKeepingOpen.current = false;
        setIsOpen(next);
      }}
      menu={{ items }}
      trigger={['click']}
      placement="bottomRight"
    >
      <Button
        type="text"
        size="small"
        icon={<MoreOutlined />}
        aria-label={t('widgets.menu.options', { defaultValue: '{{name}} options', name: widget.title })}
        className={isFloating ? 'home-widget__menu--floating' : undefined}
        style={{
          flexShrink: 0,
          color: token.colorTextSecondary,
          ...(isFloating && {
            background: token.colorBgElevated,
            border: `1px solid ${token.colorBorderSecondary}`,
          }),
        }}
      />
    </Dropdown>
  );
};
