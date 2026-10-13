import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  CloseOutlined,
  EyeInvisibleOutlined,
  Flex,
  HolderOutlined,
  Popover,
  SettingOutlined,
  Typography,
  theme,
} from '@/shared/antd-imports';

export interface WidgetEditFrameProps {
  title: string;
  isEditing: boolean;
  /** Briefly outlines the widget that was just added so the eye lands on it. */
  isFlashing?: boolean;
  /** Singleton mode (Reports > Overview): hides the widget instead of deleting it. */
  onHide?: () => void;
  /** Multi-instance mode (Custom Dashboards): removes this instance permanently. */
  onRemove?: () => void;
  /** Per-widget settings rendered in the settings popover; the popover is hidden when there are none. */
  extraSettings?: React.ReactNode;
  i18nNamespace?: string;
  children: React.ReactNode;
}

/**
 * Wraps one widget on the grid. Outside edit mode it is invisible; while customising it adds a drag
 * handle (also used to resize, via react-grid-layout), a settings popover for any per-widget
 * filters, and a hide/remove button. Ported from worklenz-business's client-portal-v2 overview grid.
 */
export const WidgetEditFrame: React.FC<WidgetEditFrameProps> = ({
  title,
  isEditing,
  isFlashing = false,
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
            {extraSettings && (
              <Popover
                trigger="click"
                placement="bottomRight"
                title={t('dashboardGrid.widgetSettings', { name: title, defaultValue: '{{name}} settings' })}
                content={
                  <Flex vertical gap={12} style={{ width: 260 }}>
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
            )}
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
