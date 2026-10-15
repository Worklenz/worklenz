import { useTranslation } from 'react-i18next';
import { Button, Dropdown, EditOutlined, Flex, PlusOutlined, Popconfirm, UndoOutlined } from '@/shared/antd-imports';
import { WIDGET_META } from './layoutModel';
import { useIsDesktop } from './useIsDesktop';
import type { DashboardLayoutApi } from './useDashboardLayout';

/** Customise / Add widget / Reset / Cancel / Save. Customising is a desktop and tablet feature. */
export const DashboardToolbar = ({ layout }: { layout: DashboardLayoutApi }) => {
  const { t } = useTranslation();
  const canCustomise = useIsDesktop();
  const hidden = layout.widgets.filter(widget => widget.hidden);

  if (!layout.isEditing) {
    if (!canCustomise) return null;
    return (
      <Button icon={<EditOutlined />} onClick={layout.startEditing}>
        {t('dashboard.customize.start', { defaultValue: 'Customise' })}
      </Button>
    );
  }

  return (
    <Flex gap={8} wrap="wrap" justify="flex-end">
      <Dropdown
        trigger={['click']}
        disabled={hidden.length === 0}
        menu={{
          items: hidden.map(widget => ({
            key: widget.type,
            label: t(WIDGET_META[widget.type].titleKey, { defaultValue: WIDGET_META[widget.type].defaultTitle }),
          })),
          onClick: ({ key }) => layout.show(key as typeof hidden[number]['type']),
        }}
      >
        <Button icon={<PlusOutlined />} disabled={hidden.length === 0}>
          {t('dashboard.customize.addWidget', { defaultValue: 'Add widget' })}
        </Button>
      </Dropdown>
      <Popconfirm
        title={t('dashboard.customize.resetConfirm', { defaultValue: 'Reset to the default overview?' })}
        description={t('dashboard.customize.resetConfirmHelp', { defaultValue: 'Your saved arrangement and widget settings will be removed.' })}
        okText={t('dashboard.customize.reset', { defaultValue: 'Reset' })}
        cancelText={t('dashboard.customize.cancel', { defaultValue: 'Cancel' })}
        onConfirm={layout.reset}
      >
        <Button icon={<UndoOutlined />}>
          {t('dashboard.customize.reset', { defaultValue: 'Reset' })}
        </Button>
      </Popconfirm>
      <Button onClick={layout.cancel}>
        {t('dashboard.customize.cancel', { defaultValue: 'Cancel' })}
      </Button>
      <Button type="primary" loading={layout.isSaving} onClick={layout.save}>
        {t('dashboard.customize.save', { defaultValue: 'Save' })}
      </Button>
    </Flex>
  );
};
