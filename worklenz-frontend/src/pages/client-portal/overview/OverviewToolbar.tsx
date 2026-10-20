import { useTranslation } from 'react-i18next';
import { UndoOutlined } from '@ant-design/icons';
import { Button, Dropdown, EditOutlined, Flex, PlusOutlined, Popconfirm } from '@/shared/antd-imports';
import { WIDGET_META } from './overview-layout';
import { useIsDesktop } from './useIsDesktop';
import type { OverviewLayoutApi } from './useOverviewLayout';
import { OVERVIEW_NS } from './widgets/WidgetFrame';

// Matches the "Add New" button on the Clients page.
const BUTTON_STYLE = { fontSize: 12, fontWeight: 500 } as const;

/** Customize / Add widget / Reset / Cancel / Save. Customizing is a desktop and tablet feature. */
export const OverviewToolbar = ({ layout }: { layout: OverviewLayoutApi }) => {
  const { t } = useTranslation(OVERVIEW_NS);
  const canCustomize = useIsDesktop();
  const hidden = layout.widgets.filter(widget => widget.hidden);

  if (!layout.isEditing) {
    if (!canCustomize) return null;
    return (
      <Button style={BUTTON_STYLE} icon={<EditOutlined />} onClick={layout.startEditing} disabled={layout.isLoading}>
        {t('edit.customize', { defaultValue: 'Customize' })}
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
            key: widget.key,
            label: t(`widgets.${widget.key}.title`, { defaultValue: WIDGET_META[widget.key].defaultTitle }),
          })),
          onClick: ({ key }) => layout.show(key as (typeof hidden)[number]['key']),
        }}
      >
        <Button style={BUTTON_STYLE} icon={<PlusOutlined />} disabled={hidden.length === 0}>
          {t('edit.addWidget', { defaultValue: 'Add widget' })}
        </Button>
      </Dropdown>
      <Popconfirm
        title={t('edit.resetConfirm', { defaultValue: 'Restore the default layout?' })}
        description={t('edit.resetConfirmHelp', { defaultValue: 'Your saved arrangement will be removed.' })}
        okText={t('edit.reset', { defaultValue: 'Reset' })}
        cancelText={t('edit.cancel', { defaultValue: 'Cancel' })}
        onConfirm={layout.reset}
      >
        <Button style={BUTTON_STYLE} icon={<UndoOutlined />}>
          {t('edit.reset', { defaultValue: 'Reset' })}
        </Button>
      </Popconfirm>
      <Button style={BUTTON_STYLE} onClick={layout.cancel}>
        {t('edit.cancel', { defaultValue: 'Cancel' })}
      </Button>
      <Button style={BUTTON_STYLE} type="primary" loading={layout.isSaving} onClick={layout.save}>
        {t('edit.save', { defaultValue: 'Save' })}
      </Button>
    </Flex>
  );
};
