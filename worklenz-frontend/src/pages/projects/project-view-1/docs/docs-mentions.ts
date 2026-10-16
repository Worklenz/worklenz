import { Editor as TiptapEditor } from '@tiptap/core';
import { MutableRefObject } from 'react';
import { projectCommentsApiService } from '@/api/projects/comments/project-comments.api.service';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { mentionStore } from './mention-store';
import { DocsSuggestionItem, DocsSuggestionMenuHandle } from './docs-suggestion-menu';

const EMPTY_TASK_ID = '00000000-0000-4000-8000-000000000000';

export interface MentionHandlers {
  mentionItems: (query: string, kind: 'member' | 'task') => Promise<DocsSuggestionItem[]>;
  applyMention: (item: DocsSuggestionItem, editor: TiptapEditor, range: { from: number; to: number }) => void;
  mentionMenu: DocsSuggestionMenuHandle | null;
}

export const loadMentionItems = async (
  projectId: string,
  query: string,
  membersRef: MutableRefObject<Array<{ id: string; name: string }>>,
  memberGroup: string,
  taskGroup: string,
  kind: 'member' | 'task'
): Promise<DocsSuggestionItem[]> => {
  if (!projectId) return [];
  if (kind === 'member') {
    try {
      if (membersRef.current.length === 0) {
        const response = await projectCommentsApiService.getMentionMembers(projectId, 1, 200, null, null, '');
        membersRef.current = (response.body || [])
          .filter(member => member.id && member.name)
          .map(member => ({ id: member.id as string, name: member.name as string }));
      }
      const needle = query.trim().toLowerCase();
      return membersRef.current
        .filter(member => member.name.toLowerCase().includes(needle))
        .slice(0, 8)
        .map(member => ({
          id: `member:${member.id}`,
          entityId: member.id,
          kind: 'member' as const,
          label: member.name,
          group: memberGroup,
        }));
    } catch {
      return [];
    }
  }

  try {
    const response = await tasksApiService.searchTask(EMPTY_TASK_ID, projectId, query.trim());
    return (response.body || []).slice(0, 8).map(task => ({
      id: `task:${task.value}`,
      entityId: task.value,
      kind: 'task' as const,
      label: task.label,
      detail: task.task_key,
      group: taskGroup,
    }));
  } catch {
    return [];
  }
};

export const insertMention = (
  item: DocsSuggestionItem,
  editor: TiptapEditor,
  range: { from: number; to: number }
) => {
  if (!item.entityId || (item.kind !== 'member' && item.kind !== 'task')) return;
  const mentions = mentionStore.get();
  // Seed display data before the node renders; the save response supplies authoritative details.
  if (item.kind === 'member') {
    mentionStore.merge({
      members: {
        [item.entityId]: {
          id: item.entityId,
          avatar_url: mentions.members[item.entityId]?.avatar_url ?? null,
          name: item.label,
          unavailable: false,
        },
      },
      tasks: {},
    });
  } else {
    mentionStore.merge({
      members: {},
      tasks: {
        [item.entityId]: {
          id: item.entityId,
          task_key: item.detail || mentions.tasks[item.entityId]?.task_key || null,
          status_name: mentions.tasks[item.entityId]?.status_name ?? null,
          status_color: mentions.tasks[item.entityId]?.status_color ?? null,
          name: item.label,
          unavailable: false,
        },
      },
    });
  }
  editor
    .chain()
    .focus()
    .insertContentAt(range, [
      {
        type: item.kind === 'member' ? 'memberMention' : 'taskMention',
        attrs: { id: item.entityId },
      },
      { type: 'text', text: ' ' },
    ])
    .run();
};

