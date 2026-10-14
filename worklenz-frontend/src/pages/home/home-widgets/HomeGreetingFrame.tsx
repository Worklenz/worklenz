import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HomeWidgetProvider, type HomeWidgetContextValue } from './HomeWidgetContext';
import { HomeWidgetMenuButton } from './HomeWidgetMenuButton';
import { HOME_GREETING_ID } from '../home-layout/homeLayout';
import './home-widgets.css';

interface HomeGreetingFrameProps {
  onRemove: () => void;
  children: React.ReactNode;
}

/**
 * Gives the greeting banner the same "..." menu as the widgets below it. The banner is not a
 * widget, since it is never dragged or moved, so the only thing the menu offers is removing it;
 * "Add widget" brings it back.
 */
export const HomeGreetingFrame: React.FC<HomeGreetingFrameProps> = ({ onRemove, children }) => {
  const { t } = useTranslation('home');
  const title = t('customize.widgets.greeting', { defaultValue: 'Greeting banner' });

  const contextValue = useMemo<HomeWidgetContextValue>(
    () => ({
      id: HOME_GREETING_ID,
      title,
      actions: { otherColumn: null, canRemove: true, onMoveToOtherColumn: () => {}, onRemove },
    }),
    [title, onRemove]
  );

  return (
    <HomeWidgetProvider value={contextValue}>
      {/* `home-widget` supplies the positioning and the reveal-on-hover of the floating menu. */}
      <div className="home-widget">
        {children}
        <HomeWidgetMenuButton isFloating />
      </div>
    </HomeWidgetProvider>
  );
};
