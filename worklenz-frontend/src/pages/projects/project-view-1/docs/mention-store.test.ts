import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_MENTIONS, IResolvedMember, IResolvedTask } from '@/types/project/project-documents.types';
import { mentionStore } from './mention-store';

const member: IResolvedMember = { id: 'member-1', name: 'Alice', avatar_url: null, unavailable: false };
const task: IResolvedTask = {
  id: 'task-1', name: 'Fix login', task_key: 'PROJ-123',
  status_name: null, status_color: null, unavailable: false,
};

beforeEach(() => mentionStore.set(EMPTY_MENTIONS));

describe('mention display cache', () => {
  it('keeps newly inserted mentions when an earlier autosave response arrives', () => {
    mentionStore.set({ members: { [member.id]: member }, tasks: { [task.id]: task } });
    mentionStore.merge({ members: { [member.id]: { ...member, name: 'Alice Smith' } }, tasks: {} });
    expect(mentionStore.get().members[member.id].name).toBe('Alice Smith');
    expect(mentionStore.get().tasks[task.id]).toEqual(task);
  });

  it('uses authoritative unavailable flags and task details from the server', () => {
    mentionStore.set({ members: { [member.id]: member }, tasks: { [task.id]: task } });
    mentionStore.merge({
      members: { [member.id]: { ...member, name: null, unavailable: true } },
      tasks: { [task.id]: { ...task, status_name: 'Done', status_color: '#123456' } },
    });
    expect(mentionStore.get().members[member.id].unavailable).toBe(true);
    expect(mentionStore.get().tasks[task.id].status_name).toBe('Done');
  });

  it('clears prior document data when a new document is loaded', () => {
    mentionStore.set({ members: { [member.id]: member }, tasks: { [task.id]: task } });
    mentionStore.set(EMPTY_MENTIONS);
    expect(mentionStore.get()).toEqual(EMPTY_MENTIONS);
  });

  it('notifies subscribers with a new snapshot when merging', () => {
    const previous = mentionStore.get();
    const listener = vi.fn();
    const unsubscribe = mentionStore.subscribe(listener);
    mentionStore.merge({ members: { [member.id]: member }, tasks: {} });
    expect(mentionStore.get()).not.toBe(previous);
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
