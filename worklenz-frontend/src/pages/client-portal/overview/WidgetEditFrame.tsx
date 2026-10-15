import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  Button,
  EyeInvisibleOutlined,
  Flex,
  HolderOutlined,
  Popover,
  Select,
  SettingOutlined,
  Typography,
  theme,
} from '@/shared/antd-imports';
import type { OverviewWidgetInstance } from '@/types/client-portal/v2/overview';
import { WIDGET_META, WIDTH_OPTIONS } from './overview-layout';
import type { OverviewLayoutApi } from './useOverviewLayout';
import { OVERVIEW_NS } from './widgets/WidgetFrame';

interface WidgetEditFrameProps {
  widget: OverviewWidgetInstance;
  isEditing: boolean;
  layout: OverviewLayoutApi;
  /** Briefly outlines the widget that was just added so the eye lands on it. */
  isFlashing?: boolean;
  children: React.ReactNode;
}

/**
 * Wraps one widget. Outside edit mode it is invisible; while customising it adds a drag handle, a
 * settings popover (keyboard-friendly move and width controls) and a hide button.
 */
export const WidgetEditFrame = ({ widget, isEditing, layout, isFlashing = false, children }: WidgetEditFrameProps) => {
  const { t } = useTranslation(OVERVIEW_NS);
  const { token } = theme.useToken();
  const meta = WIDGET_META[widget.key];
  const title = t(`widgets.${widget.key}.title`, { defaultValue: meta.defaultTitle });

  return (
    <Flex
      vertical
      style={{
        height: '100%',
        borderRadius: 8,
        outline: isFlashing
          ? `3px solid ${token.colorPrimary}`
          : isEditing
            ? `1px dashed ${token.colorPrimaryBorder}`
            : undefined,
        outlineOffset: 2,
        transition: 'outline-color 300ms ease',
      }}
    >
      {isEditing && (
        <Flex
          align="center"
          justify="space-between"
          gap={4}
          style={{
            height: 36,
            flex: '0 0 auto',
            padding: '0 4px',
            background: token.colorFillQuaternary,
            borderRadius: '8px 8px 0 0',
          }}
        >
          <Flex className="overview-drag-handle" align="center" gap={4} style={{ flex: 1, minWidth: 0, cursor: 'grab' }}>
            <HolderOutlined aria-hidden style={{ color: token.colorTextTertiary }} />
            <Typography.Text ellipsis type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {title}
            </Typography.Text>
          </Flex>
          <Flex className="overview-no-drag" gap={2}>
            <Popover
              trigger="click"
              placement="bottomRight"
              title={t('edit.widgetSettings', { name: title, defaultValue: '{{name}} settings' })}
              content={<WidgetSettings widget={widget} layout={layout} />}
            >
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                aria-label={t('edit.settingsFor', { name: title, defaultValue: 'Settings for {{name}}' })}
              />
            </Popover>
            <Button
              type="text"
              size="small"
              icon={<EyeInvisibleOutlined />}
              onClick={() => layout.hide(widget.key)}
              aria-label={t('edit.hideNamed', { title, defaultValue: 'Hide {{title}}' })}
            />
          </Flex>
        </Flex>
      )}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', pointerEvents: isEditing ? 'none' : undefined }}>
        {children}
      </div>
    </Flex>
  );
};

const WIDTH_LABELS: Record<number, [string, string]> = {
  3: ['edit.widthQuarter', 'Quarter width'],
  4: ['edit.widthThird', 'One third'],
  6: ['edit.widthHalf', 'Half width'],
  8: ['edit.widthTwoThirds', 'Two thirds'],
  9: ['edit.widthThreeQuarters', 'Three quarters'],
  12: ['edit.widthFull', 'Full width'],
};

const WidgetSettings = ({ widget, layout }: { widget: OverviewWidgetInstance; layout: OverviewLayoutApi }) => {
  const { t } = useTranslation(OVERVIEW_NS);
  const widthOptions = WIDTH_OPTIONS.filter(w => w >= WIDGET_META[widget.key].min.w).map(w => ({
    value: w,
    label: t(WIDTH_LABELS[w][0], { defaultValue: WIDTH_LABELS[w][1] }),
  }));

  return (
    <Flex vertical gap={12} style={{ width: 240 }}>
      <Flex vertical gap={4}>
        <Typography.Text strong>{t('edit.width', { defaultValue: 'Width' })}</Typography.Text>
        <Select
          value={widget.w}
          options={widthOptions}
          onChange={w => layout.resize(widget.key, { w })}
          aria-label={t('edit.width', { defaultValue: 'Width' })}
        />
      </Flex>
      <Flex gap={8}>
        <Button icon={<ArrowUpOutlined />} onClick={() => layout.move(widget.key, -1)}>
          {t('edit.moveEarlier', { defaultValue: 'Move earlier' })}
        </Button>
        <Button icon={<ArrowDownOutlined />} onClick={() => layout.move(widget.key, 1)}>
          {t('edit.moveLater', { defaultValue: 'Move later' })}
        </Button>
      </Flex>
    </Flex>
  );
};
