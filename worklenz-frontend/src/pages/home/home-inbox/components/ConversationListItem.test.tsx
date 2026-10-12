import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import ConversationListItem from './ConversationListItem';
import zhHomeInbox from '../../../../../public/locales/zh/home-inbox.json';

// Initialize a test i18n instance with zh translations
const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'zh',
  fallbackLng: 'en',
  resources: {
    zh: {
      'home-inbox': zhHomeInbox,
    },
  },
  interpolation: {
    escapeValue: false,
  },
});

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: any) => any) =>
    selector({
      themeReducer: { mode: 'light' },
    }),
}));

describe('ConversationListItem Localization', () => {
  it('renders localized yesterday label and category tags in Chinese', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const conversation = {
      id: 'c-1',
      category: 'project' as const,
      name: 'Alpha Project',
      authorName: 'Ushani',
      lastMessage: 'Hi check',
      lastMessageTime: yesterday.toISOString(),
      unreadCount: 2,
    };

    render(
      <I18nextProvider i18n={testI18n}>
        <ConversationListItem
          conversation={conversation}
          isActive={false}
          isPinned={false}
          showCategoryTag={true}
          onClick={vi.fn()}
          onTogglePin={vi.fn()}
        />
      </I18nextProvider>
    );

    // Name and message
    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    expect(screen.getByText('Hi check')).toBeInTheDocument();

    // Localized yesterday label (昨天)
    expect(screen.getByText(/昨天/)).toBeInTheDocument();

    // Localized category tag (项目)
    expect(screen.getByText('项目')).toBeInTheDocument();
  });
});
