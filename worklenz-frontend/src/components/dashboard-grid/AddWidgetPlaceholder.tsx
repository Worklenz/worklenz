import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown, PlusOutlined, Typography, theme } from '@/shared/antd-imports';
import { useAddWidgetMenu } from './useAddWidgetMenu';
import type { DashboardLayoutApi } from './useDashboardLayoutDraft';
import type { WidgetDefinition } from './layout-model';

export interface AddWidgetPlaceholderProps<TType extends string, TConfig = unknown> {
  layout: DashboardLayoutApi<TType, TConfig>;
  catalogue: WidgetDefinition<TType>[];
  titleOf: (type: TType) => string;
  descriptionOf?: (type: TType) => string | undefined;
  i18nNamespace?: string;
}

/** A dashed-border "Add widget" tile filling an empty grid slot; opens the same picker as the toolbar's Add widget button. */
export function AddWidgetPlaceholder<TType extends string, TConfig = unknown>({
  layout,
  catalogue,
  titleOf,
  descriptionOf,
  i18nNamespace,
}: AddWidgetPlaceholderProps<TType, TConfig>) {
  const { t } = useTranslation(i18nNamespace);
  const { token } = theme.useToken();
  const { canAdd, menu } = useAddWidgetMenu({ layout, catalogue, titleOf, descriptionOf });

  const tile = (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        border: `1px dashed ${token.colorBorder}`,
        borderRadius: token.borderRadiusLG,
        color: token.colorTextTertiary,
        cursor: canAdd ? 'pointer' : 'not-allowed',
      }}
    >
      <PlusOutlined style={{ fontSize: 18 }} />
      <Typography.Text type="secondary">{t('dashboardGrid.addWidget', { defaultValue: 'Add widget' })}</Typography.Text>
    </div>
  );

  return (
    <Dropdown trigger={['click']} disabled={!canAdd} menu={menu}>
      {tile}
    </Dropdown>
  );
}
