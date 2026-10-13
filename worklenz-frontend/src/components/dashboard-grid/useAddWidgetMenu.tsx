import { Flex, Typography, theme } from '@/shared/antd-imports';
import type { DashboardLayoutApi } from './useDashboardLayoutDraft';
import type { WidgetDefinition } from './layout-model';

export interface UseAddWidgetMenuOptions<TType extends string, TConfig = unknown> {
  layout: DashboardLayoutApi<TType, TConfig>;
  catalogue: WidgetDefinition<TType>[];
  titleOf: (type: TType) => string;
  /** One-line "what is this" shown under each title in the "Add widget" list. */
  descriptionOf?: (type: TType) => string | undefined;
}

/**
 * The "Add widget" dropdown menu: hidden singleton instances to unhide, plus repeatable widget
 * types to add another instance of. Shared by the toolbar's "Add widget" button and the grid's
 * empty-slot placeholders so both stay in sync with a single source of truth.
 */
export function useAddWidgetMenu<TType extends string, TConfig = unknown>({
  layout,
  catalogue,
  titleOf,
  descriptionOf,
}: UseAddWidgetMenuOptions<TType, TConfig>) {
  const { token } = theme.useToken();
  const hidden = layout.widgets.filter(widget => widget.hidden);
  const repeatableDefs = catalogue.filter(def => def.repeatable);
  const canAdd = hidden.length > 0 || repeatableDefs.length > 0;

  const menuLabel = (type: TType) => {
    const description = descriptionOf?.(type);
    return description ? (
      <Flex vertical gap={0} style={{ padding: '2px 0' }}>
        <Typography.Text>{titleOf(type)}</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, whiteSpace: 'normal' }}>
          {description}
        </Typography.Text>
      </Flex>
    ) : (
      titleOf(type)
    );
  };

  const menu = {
    items: [
      ...hidden.map(widget => ({ key: `hide:${widget.id}`, label: menuLabel(widget.type) })),
      ...repeatableDefs.map(def => ({ key: `add:${def.type}`, label: menuLabel(def.type) })),
    ],
    onClick: ({ key }: { key: string }) => {
      if (key.startsWith('add:')) {
        const type = key.slice(4) as TType;
        const def = catalogue.find(item => item.type === type);
        if (def) layout.add(def.type, def);
        return;
      }
      const id = key.slice('hide:'.length);
      const widget = hidden.find(item => item.id === id);
      const def = widget && catalogue.find(item => item.type === widget.type);
      if (def) layout.show(def.type, def);
    },
  };

  return { canAdd, menu };
}
