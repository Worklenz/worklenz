import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  Button,
  CloseOutlined,
  EyeInvisibleOutlined,
  Flex,
  HolderOutlined,
  Popover,
  Select,
  SettingOutlined,
  Typography,
  theme,
} from '@/shared/antd-imports';

export interface WidgetEditFrameProps {
  title: string;
  isEditing: boolean;
  /** Briefly outlines the widget that was just added so the eye lands on it. */
  isFlashing?: boolean;
  /** Widths (grid columns) the user may pick from, already filtered to this widget's minimum. */
  widthOptions: number[];
  width: number;
  onResize: (w: number) => void;
  onMoveEarlier: () => void;
  onMoveLater: () => void;
  /** Singleton mode (Reports > Overview): hides the widget instead of deleting it. */
  onHide?: () => void;
  /** Multi-instance mode (Custom Dashboards): removes this instance permanently. */
  onRemove?: () => void;
  /** Extra per-widget settings rendered below the width/move controls in the settings popover. */
  extraSettings?: React.ReactNode;
  i18nNamespace?: string;
  children: React.ReactNode;
}

const WIDTH_LABELS: Record<number, [string, string]> = {
  3: ['dashboardGrid.widthQuarter', 'Quarter width'],
  4: ['dashboardGrid.widthThird', 'One third'],
  6: ['dashboardGrid.widthHalf', 'Half width'],
  8: ['dashboardGrid.widthTwoThirds', 'Two thirds'],
  9: ['dashboardGrid.widthThreeQuarters', 'Three quarters'],
  12: ['dashboardGrid.widthFull', 'Full width'],
};

/**
 * Wraps one widget on the grid. Outside edit mode it is invisible; while customising it adds a drag
 * handle, a settings popover (a keyboard-friendly alternative to dragging: width and move controls)
 * and a hide/remove button. Ported from worklenz-business's client-portal-v2 overview grid.
 */
export const WidgetEditFrame: React.FC<WidgetEditFrameProps> = ({
  title,
  isEditing,
  isFlashing = false,
  widthOptions,
  width,
  onResize,
  onMoveEarlier,
  onMoveLater,
  onHide,
  onRemove,
  extraSettings,
  i18nNamespace,
  children,
}) => {
  const { t } = useTranslation(i18nNamespace);
  const { token } = theme.useToken();

  return (
    <Flex
      vertical
      style={{
        height: '100%',
        borderRadius: 8,
        outline: isFlashing ? `3px solid ${token.colorPrimary}` : isEditing ? `1px dashed ${token.colorPrimaryBorder}` : undefined,
        outlineOffset: 2,
        transition: 'outline-color 300ms ease',
      }}
    >
      {isEditing && (
        <Flex
          align="center"
          justify="space-between"
          gap={4}
          style={{ height: 36, flex: '0 0 auto', padding: '0 4px', background: token.colorFillQuaternary, borderRadius: '8px 8px 0 0' }}
        >
          <Flex className="wl-dashboard-drag-handle" align="center" gap={4} style={{ flex: 1, minWidth: 0, cursor: 'grab' }}>
            <HolderOutlined aria-hidden style={{ color: token.colorTextTertiary }} />
            <Typography.Text ellipsis type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {title}
            </Typography.Text>
          </Flex>
          <Flex className="wl-dashboard-no-drag" gap={2}>
            <Popover
              trigger="click"
              placement="bottomRight"
              title={t('dashboardGrid.widgetSettings', { name: title, defaultValue: '{{name}} settings' })}
              content={
                <Flex vertical gap={12} style={{ width: 260 }}>
                  <Flex vertical gap={4}>
                    <Typography.Text strong>{t('dashboardGrid.width', { defaultValue: 'Width' })}</Typography.Text>
                    <Select
                      value={width}
                      options={widthOptions.map(w => ({
                        value: w,
                        label: t(WIDTH_LABELS[w]?.[0] ?? 'dashboardGrid.widthCustom', {
                          defaultValue: WIDTH_LABELS[w]?.[1] ?? `${w} columns`,
                        }),
                      }))}
                      onChange={onResize}
                      aria-label={t('dashboardGrid.width', { defaultValue: 'Width' })}
                    />
                  </Flex>
                  <Flex gap={8}>
                    <Button icon={<ArrowUpOutlined />} onClick={onMoveEarlier}>
                      {t('dashboardGrid.moveEarlier', { defaultValue: 'Move earlier' })}
                    </Button>
                    <Button icon={<ArrowDownOutlined />} onClick={onMoveLater}>
                      {t('dashboardGrid.moveLater', { defaultValue: 'Move later' })}
                    </Button>
                  </Flex>
                  {extraSettings}
                </Flex>
              }
            >
              <Button
                type="text"
                icon={<SettingOutlined />}
                aria-label={t('dashboardGrid.settingsFor', { name: title, defaultValue: 'Settings for {{name}}' })}
              />
            </Popover>
            {onHide && (
              <Button
                type="text"
                icon={<EyeInvisibleOutlined />}
                onClick={onHide}
                aria-label={t('dashboardGrid.hideWidget', { name: title, defaultValue: 'Hide {{name}}' })}
              />
            )}
            {onRemove && (
              <Button
                type="text"
                icon={<CloseOutlined />}
                onClick={onRemove}
                aria-label={t('dashboardGrid.removeWidget', { name: title, defaultValue: 'Remove {{name}}' })}
              />
            )}
          </Flex>
        </Flex>
      )}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', pointerEvents: isEditing ? 'none' : undefined }}>{children}</div>
    </Flex>
  );
};
