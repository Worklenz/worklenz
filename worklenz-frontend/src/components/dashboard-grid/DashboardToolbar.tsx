import React from 'react';
import { useTranslation } from 'react-i18next';
import { UndoOutlined } from '@ant-design/icons';
import { Button, Dropdown, EditOutlined, Flex, PlusOutlined, Popconfirm } from '@/shared/antd-imports';
import { useIsDesktop } from './useIsDesktop';
import type { DashboardLayoutApi } from './useDashboardLayoutDraft';
import type { WidgetDefinition } from './layout-model';

export interface DashboardToolbarProps<TType extends string, TConfig = unknown> {
  layout: DashboardLayoutApi<TType, TConfig>;
  /** The catalogue of widgets available to add, in catalogue order. */
  catalogue: WidgetDefinition<TType>[];
  titleOf: (type: TType) => string;
  i18nNamespace?: string;
  /**
   * Singleton mode (Reports > Overview, default): "Add widget" lists hidden instances and unhides
   * one. Pass `onAddGadget` for multi-instance mode (Custom Dashboards) to open a gadget library
   * instead, since the same type can be added more than once.
   */
  onAddGadget?: () => void;
}

/** Customise / Add widget / Reset / Cancel / Save. Customising is a desktop and tablet feature. */
export function DashboardToolbar<TType extends string, TConfig = unknown>({
  layout,
  catalogue,
  titleOf,
  i18nNamespace,
  onAddGadget,
}: DashboardToolbarProps<TType, TConfig>) {
  const { t } = useTranslation(i18nNamespace);
  const canCustomize = useIsDesktop();
  const hidden = layout.widgets.filter(widget => widget.hidden);

  if (!layout.isEditing) {
    if (!canCustomize) return null;
    return (
      <Button icon={<EditOutlined />} onClick={layout.startEditing} disabled={layout.isLoading}>
        {t('dashboardGrid.customize', { defaultValue: 'Customize' })}
      </Button>
    );
  }

  return (
    <Flex gap={8} wrap="wrap" justify="flex-end">
      {onAddGadget ? (
        <Button icon={<PlusOutlined />} onClick={onAddGadget}>
          {t('dashboardGrid.addGadget', { defaultValue: 'Add gadget' })}
        </Button>
      ) : (
        <Dropdown
          trigger={['click']}
          disabled={hidden.length === 0}
          menu={{
            items: hidden.map(widget => ({ key: widget.id, label: titleOf(widget.type) })),
            onClick: ({ key }) => {
              const def = catalogue.find(item => item.type === key);
              if (def) layout.show(def.type, def);
            },
          }}
        >
          <Button icon={<PlusOutlined />} disabled={hidden.length === 0}>
            {t('dashboardGrid.addWidget', { defaultValue: 'Add widget' })}
          </Button>
        </Dropdown>
      )}
      <Popconfirm
        title={t('dashboardGrid.resetConfirm', { defaultValue: 'Reset to the default layout?' })}
        description={t('dashboardGrid.resetConfirmHelp', { defaultValue: 'Your saved arrangement and widget settings will be removed.' })}
        okText={t('dashboardGrid.reset', { defaultValue: 'Reset' })}
        cancelText={t('dashboardGrid.cancel', { defaultValue: 'Cancel' })}
        onConfirm={layout.reset}
      >
        <Button icon={<UndoOutlined />}>{t('dashboardGrid.reset', { defaultValue: 'Reset' })}</Button>
      </Popconfirm>
      <Button onClick={layout.cancel}>{t('dashboardGrid.cancel', { defaultValue: 'Cancel' })}</Button>
      <Button type="primary" loading={layout.isSaving} onClick={layout.save}>
        {t('dashboardGrid.save', { defaultValue: 'Save' })}
      </Button>
    </Flex>
  );
}
