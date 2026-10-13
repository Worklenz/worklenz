import { createContext, useContext } from 'react';
import type { HomeColumn, HomeSectionId } from '../home-layout/homeLayout';

// What a widget on the Home overview knows about its own place on the page. The shell around each
// widget provides it, so a widget can put the "..." menu in its own header without being told
// anything about the layout. The greeting banner provides it too, with fewer actions.

export interface HomeWidgetActions {
  /** The other column the widget may be sent to, or null when it can only live in one. */
  otherColumn: HomeColumn | null;
  canRemove: boolean;
  onMoveToOtherColumn: () => void;
  onRemove: () => void;
}

export interface HomeWidgetContextValue {
  id: HomeSectionId;
  /** The widget's name, for labels. */
  title: string;
  /** The column the widget is in: a wide main area or the narrow side panel. Null where there are no columns (small screens). */
  column?: HomeColumn | null;
  actions: HomeWidgetActions;
}

const HomeWidgetContext = createContext<HomeWidgetContextValue | null>(null);

export const HomeWidgetProvider = HomeWidgetContext.Provider;

/** The enclosing widget, or null when the component is rendered outside the Home overview. */
export const useHomeWidget = (): HomeWidgetContextValue | null => useContext(HomeWidgetContext);
