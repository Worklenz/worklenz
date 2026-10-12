import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from '@/shared/antd-imports';
import {
  addInstance,
  applyGeometry,
  GridLayout,
  GridWidgetInstance,
  hideWidget,
  moveWidget,
  removeInstance,
  resizeWidget,
  showWidget,
  updateConfig,
  WidgetDefinition,
} from './layout-model';

export interface DashboardLayoutSource<TType extends string, TConfig = unknown> {
  /** The reconciled, safe-to-render layout for this user/page right now. */
  layout: GridLayout<TType, TConfig>;
  isLoading: boolean;
  save: (layout: GridLayout<TType, TConfig>) => Promise<void>;
  reset: () => Promise<void>;
}

export interface DashboardLayoutApi<TType extends string, TConfig = unknown> {
  widgets: GridWidgetInstance<TType, TConfig>[];
  isLoading: boolean;
  isEditing: boolean;
  /** The draft differs from what is saved: leaving now would lose changes. */
  isDirty: boolean;
  /** The widget most recently added, so the grid can scroll to and highlight it. */
  lastAdded: { id: string; at: number } | null;
  isSaving: boolean;
  startEditing: () => void;
  cancel: () => void;
  save: () => Promise<void>;
  reset: () => Promise<void>;
  setGeometry: (items: ReadonlyArray<{ i: string; x: number; y: number; w: number; h: number }>) => void;
  move: (id: string, direction: -1 | 1) => void;
  resize: (id: string, size: Partial<{ w: number; h: number }>, min: { w: number; h: number }) => void;
  updateWidgetConfig: (id: string, patch: (config: TConfig | undefined) => TConfig) => void;
  /** Singleton mode (Reports > Overview): hide/show an existing instance instead of adding/removing one. */
  hide: (id: string) => void;
  show: (type: TType, def: WidgetDefinition<TType>) => void;
  /** Multi-instance mode (Custom Dashboards): add a new instance of a type, or remove one permanently. */
  add: (type: TType, def: WidgetDefinition<TType>, config?: TConfig) => void;
  remove: (id: string) => void;
}

/**
 * The widget-grid arrangement: what is saved, plus a draft while the user customises. Nothing is
 * persisted until they press Save; Cancel throws the draft away. Generic over where the saved
 * layout comes from (`source`), so the same hook drives Reports > Overview (one layout per user)
 * and Custom Dashboards (one layout per dashboard).
 */
export function useDashboardLayoutDraft<TType extends string, TConfig = unknown>(
  source: DashboardLayoutSource<TType, TConfig>,
  i18nNamespace?: string
): DashboardLayoutApi<TType, TConfig> {
  const { t } = useTranslation(i18nNamespace);
  const [draft, setDraft] = useState<GridLayout<TType, TConfig> | null>(null);
  const [lastAdded, setLastAdded] = useState<DashboardLayoutApi<TType, TConfig>['lastAdded']>(null);
  const [isSaving, setIsSaving] = useState(false);

  const saved = source.layout;
  const current = draft ?? saved;

  const edit = useCallback(
    (change: (widgets: GridWidgetInstance<TType, TConfig>[]) => GridWidgetInstance<TType, TConfig>[]) => {
      setDraft(previous => {
        const base = previous ?? saved;
        const widgets = change(base.widgets);
        return widgets === base.widgets && previous !== null ? previous : { ...base, widgets };
      });
    },
    [saved]
  );

  const isDirty = useMemo(
    () => draft !== null && JSON.stringify(draft.widgets) !== JSON.stringify(saved.widgets),
    [draft, saved]
  );

  const startEditing = useCallback(() => setDraft(saved), [saved]);
  const cancel = useCallback(() => {
    setDraft(null);
    setLastAdded(null);
  }, []);

  const save = useCallback(async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      await source.save(draft);
      setDraft(null);
      setLastAdded(null);
      message.success(t('dashboardGrid.saved', { defaultValue: 'Layout saved' }));
    } catch {
      message.error(t('dashboardGrid.saveFailed', { defaultValue: 'Could not save your changes. Try again.' }));
    } finally {
      setIsSaving(false);
    }
  }, [draft, source, t]);

  const reset = useCallback(async () => {
    try {
      await source.reset();
      setDraft(null);
      setLastAdded(null);
      message.success(t('dashboardGrid.resetDone', { defaultValue: 'Reset to the default layout' }));
    } catch {
      message.error(t('dashboardGrid.resetFailed', { defaultValue: 'Could not reset. Try again.' }));
    }
  }, [source, t]);

  const setGeometry = useCallback<DashboardLayoutApi<TType, TConfig>['setGeometry']>(
    items => edit(widgets => applyGeometry(widgets, items)),
    [edit]
  );
  const move = useCallback<DashboardLayoutApi<TType, TConfig>['move']>(
    (id, direction) => edit(widgets => moveWidget(widgets, id, direction)),
    [edit]
  );
  const resize = useCallback<DashboardLayoutApi<TType, TConfig>['resize']>(
    (id, size, min) => edit(widgets => resizeWidget(widgets, id, size, min)),
    [edit]
  );
  const updateWidgetConfig = useCallback<DashboardLayoutApi<TType, TConfig>['updateWidgetConfig']>(
    (id, patch) => edit(widgets => updateConfig(widgets, id, patch)),
    [edit]
  );
  const hide = useCallback<DashboardLayoutApi<TType, TConfig>['hide']>(id => edit(widgets => hideWidget(widgets, id)), [edit]);
  const show = useCallback<DashboardLayoutApi<TType, TConfig>['show']>(
    (type, def) => {
      setLastAdded({ id: type, at: Date.now() });
      edit(widgets => showWidget(widgets, type, def));
    },
    [edit]
  );
  const add = useCallback<DashboardLayoutApi<TType, TConfig>['add']>(
    (type, def, config) => {
      edit(widgets => {
        const result = addInstance(widgets, type, def, config);
        setLastAdded({ id: result.id, at: Date.now() });
        return result.widgets;
      });
    },
    [edit]
  );
  const remove = useCallback<DashboardLayoutApi<TType, TConfig>['remove']>(id => edit(widgets => removeInstance(widgets, id)), [edit]);

  return {
    widgets: current.widgets,
    isLoading: source.isLoading,
    isEditing: draft !== null,
    isDirty,
    lastAdded,
    isSaving,
    startEditing,
    cancel,
    save,
    reset,
    setGeometry,
    move,
    resize,
    updateWidgetConfig,
    hide,
    show,
    add,
    remove,
  };
}
