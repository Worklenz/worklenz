import { IDocumentMentionMap, EMPTY_MENTIONS } from '@/types/project/project-documents.types';

type Listener = () => void;

let snapshot: IDocumentMentionMap = EMPTY_MENTIONS;
const listeners = new Set<Listener>();

export const mentionStore = {
  get: () => snapshot,
  set: (next: IDocumentMentionMap) => {
    snapshot = next;
    listeners.forEach(listener => listener());
  },
  // A save response may arrive while newer mentions are still waiting to be saved.
  merge: (next: IDocumentMentionMap) => {
    mentionStore.set({
      members: { ...snapshot.members, ...next.members },
      tasks: { ...snapshot.tasks, ...next.tasks },
    });
  },
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  openTask: (_taskId: string) => undefined as void,
};
