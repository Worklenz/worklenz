import React from 'react';
import { useTranslation } from 'react-i18next';
import { UndoOutlined } from '@ant-design/icons';
import { Button, Dropdown, EditOutlined, Flex, PlusOutlined, Popconfirm } from '@/shared/antd-imports';
import { useIsDesktop } from './useIsDesktop';
import { useAddWidgetMenu } from './useAddWidgetMenu';
import type { DashboardLayoutApi } from './useDashboardLayoutDraft';
import type { WidgetDefinition } from './layout-model';

export interface DashboardToolbarProps<TType extends string, TConfig = unknown> {
  layout: DashboardLayoutApi<TType, TConfig>;
  /** The catalogue of widgets available to add, in catalogue order. */
  catalogue: WidgetDefinition<TType>[];
  titleOf: (type: TType) => string;
  /** One-line "what is this" shown under each title in the "Add widget" list. */
  descriptionOf?: (type: TType) => string | undefined;
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
  descriptionOf,
  i18nNamespace,
  onAddGadget,
}: DashboardToolbarProps<TType, TConfig>) {
  const { t } = useTranslation(i18nNamespace);
  const canCustomize = useIsDesktop();
  const { canAdd, menu } = useAddWidgetMenu({ layout, catalogue, titleOf, descriptionOf });

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
        <Dropdown trigger={['click']} disabled={!canAdd} menu={menu}>
          <Button icon={<PlusOutlined />} disabled={!canAdd}>
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
