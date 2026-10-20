import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { exitSuggestion, findSuggestionMatch, SuggestionProps } from '@tiptap/suggestion';
import { MutableRefObject } from 'react';
import { DocsBlockCommand, findDocumentBlock, turnBlockInto } from '../docs-block-commands';
import {
  DocsSuggestionItem,
  DocsSuggestionMenuHandle,
  suggestionPosition,
} from '../DocsSuggestionMenu';

export const slashPluginKey = new PluginKey('docs-slash-commands');

export const createSlashCommands = (
  commandsRef: MutableRefObject<DocsBlockCommand[]>,
  menuRef: MutableRefObject<DocsSuggestionMenuHandle | null>
) =>
  Extension.create({
    name: 'docsSlashCommands',
    priority: 200,
    addProseMirrorPlugins() {
      const showMenu = (props: SuggestionProps<DocsSuggestionItem>, update: boolean) => {
        const next = {
          items: props.items,
          ...suggestionPosition(props.clientRect),
          command: (item: DocsSuggestionItem) => props.command(item),
        };
        if (update) menuRef.current?.update(next);
        else menuRef.current?.open(next);
      };
      return [
        Suggestion<DocsSuggestionItem>({
          pluginKey: slashPluginKey,
          editor: this.editor,
          char: '/',
          allowSpaces: true,
          allowedPrefixes: null,
        findSuggestionMatch: options => {
          const match = findSuggestionMatch(options);
          if (!match) return null;
          // Only consume the command before the caret; existing text to its right stays intact.
          const to = options.$position.pos;
          const text = match.text.slice(0, to - match.range.from);
          return { ...match, range: { from: match.range.from, to }, text, query: text.slice(1) };
        },
          allow: ({ editor, state, range }) => {
            const position = state.doc.resolve(range.from);
            return (
              !editor.view.composing &&
              position.parent.type.name === 'paragraph' &&
              position.parentOffset === 0 &&
              position.depth === 1
            );
          },
          items: ({ query }) => {
            const needle = query.trim().toLocaleLowerCase();
            return commandsRef.current
              .filter(command =>
                `${command.label} ${command.keywords}`.toLocaleLowerCase().includes(needle)
              )
              .map(command => ({ id: command.kind, kind: 'block', label: command.label }));
          },
          command: ({ editor, range, props }) => {
            const command = commandsRef.current.find(item => item.kind === props.id);
            if (command) turnBlockInto(editor, command.kind, findDocumentBlock(editor), range);
            exitSuggestion(editor.view, slashPluginKey);
            menuRef.current?.close();
          },
          render: () => ({
            onStart: props => showMenu(props, false),
            onUpdate: props => showMenu(props, true),
            onExit: () => menuRef.current?.close(),
            onKeyDown: ({ event, view }) => {
              if (event.isComposing || view.composing) return false;
              if (event.key === 'Escape') {
                exitSuggestion(view, slashPluginKey);
                menuRef.current?.close();
                return true;
              }
              return menuRef.current?.onKeyDown(event) ?? false;
            },
          }),
        }),
      ];
    },
  });
