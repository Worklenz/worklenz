import { render, screen, cleanup, act } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import enDocs from '../../../../../public/locales/en/project-view-docs.json';
import itDocs from '../../../../../public/locales/it/project-view-docs.json';
import { DocsDocumentEditor } from './DocsDocumentEditor';
import { ISectionDocument } from '@/types/project/project-documents.types';

vi.mock('./extensions/member-mention', async () => {
  const { Node } = await import('@tiptap/core');
  return {
    MemberMention: Node.create({
      name: 'memberMention',
      group: 'inline',
      inline: true,
      atom: true,
      addAttributes: () => ({ id: { default: null } }),
      renderHTML: ({ HTMLAttributes }) => ['span', HTMLAttributes, '@member'],
    }),
  };
});

vi.mock('./extensions/task-mention', async () => {
  const { Node } = await import('@tiptap/core');
  return {
    TaskMention: Node.create({
      name: 'taskMention',
      group: 'inline',
      inline: true,
      atom: true,
      addAttributes: () => ({ id: { default: null } }),
      renderHTML: ({ HTMLAttributes }) => ['span', HTMLAttributes, '#task'],
    }),
  };
});

vi.mock('@tiptap/react/menus', async () => {
  return { BubbleMenu: () => null };
});

afterEach(cleanup);

const emptyContent: ISectionDocument = {
  version: 1,
  sections: [
    {
      id: 'section-1',
      type: 'paragraph',
      content: [],
    },
  ],
};

describe('DocsDocumentEditor Placeholder Localization', () => {
  it('renders Italian placeholder instructions when language is Italian', async () => {
    const instance = createInstance();
    await instance.init({
      lng: 'it',
      fallbackLng: 'en',
      defaultNS: 'project-view-docs',
      resources: {
        en: { 'project-view-docs': enDocs },
        it: { 'project-view-docs': itDocs },
      },
    });

    const handlersRef = {
      current: {
        mentionItems: async () => [],
        applyMention: () => undefined,
        mentionMenu: null,
      },
    };

    render(
      <I18nextProvider i18n={instance}>
        <DocsDocumentEditor
          content={emptyContent}
          handlersRef={handlersRef}
          onChange={vi.fn()}
          onActivity={vi.fn()}
        />
      </I18nextProvider>
    );

    const emptyParagraph = document.querySelector('.is-empty');
    expect(emptyParagraph).not.toBeNull();
    expect(emptyParagraph?.getAttribute('data-placeholder')).toBe(
      'Scrivi, usa «/» per i blocchi, «@» per i membri e «#» per le attività'
    );
  });

  it('updates placeholder when language changes from English to Italian', async () => {
    const instance = createInstance();
    await instance.init({
      lng: 'en',
      fallbackLng: 'en',
      defaultNS: 'project-view-docs',
      resources: {
        en: { 'project-view-docs': enDocs },
        it: { 'project-view-docs': itDocs },
      },
    });

    const handlersRef = {
      current: {
        mentionItems: async () => [],
        applyMention: () => undefined,
        mentionMenu: null,
      },
    };

    render(
      <I18nextProvider i18n={instance}>
        <DocsDocumentEditor
          content={emptyContent}
          handlersRef={handlersRef}
          onChange={vi.fn()}
          onActivity={vi.fn()}
        />
      </I18nextProvider>
    );

    const paragraphEn = document.querySelector('.is-empty');
    expect(paragraphEn?.getAttribute('data-placeholder')).toBe(
      "Write, '/' for blocks, '@' for members, '#' for tasks"
    );

    await act(async () => {
      await instance.changeLanguage('it');
    });

    const paragraphIt = document.querySelector('.is-empty');
    expect(paragraphIt?.getAttribute('data-placeholder')).toBe(
      'Scrivi, usa «/» per i blocchi, «@» per i membri e «#» per le attività'
    );
  });
});
