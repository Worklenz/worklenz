import { useCallback, useRef, useState } from 'react';

import { projectDocumentsApiService } from '@/api/projects/docs/project-documents.api.service';
import { IProjectDocument, ISectionDocument } from '@/types/project/project-documents.types';

type FlushResult = 'idle' | 'saved' | 'conflict' | 'error';
export type DocsSaveState = 'saved' | 'saving' | 'error' | 'conflict';

interface AutosavePayload {
  documentId: string;
  title: string;
  content: ISectionDocument;
}

const fingerprint = (title: string, content: ISectionDocument) =>
  JSON.stringify({ title: title.trim(), content });

export const useDocsAutosave = (
  onSaved: (document: IProjectDocument) => void,
  onConflict: (document: IProjectDocument) => void
) => {
  const [saveState, setSaveState] = useState<DocsSaveState>('saved');
  const timerRef = useRef<number | null>(null);
  const payloadRef = useRef<AutosavePayload | null>(null);
  const updatedAtRef = useRef<string | null>(null);
  const savedFingerprintRef = useRef('');
  const blockedRef = useRef(false);
  const onSavedRef = useRef(onSaved);
  const onConflictRef = useRef(onConflict);
  onSavedRef.current = onSaved;
  onConflictRef.current = onConflict;

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const markClean = useCallback((document: Pick<IProjectDocument, 'id' | 'title' | 'content' | 'updated_at'>) => {
    clearTimer();
    payloadRef.current = {
      documentId: document.id,
      title: document.title,
      content: document.content,
    };
    updatedAtRef.current = document.updated_at;
    savedFingerprintRef.current = fingerprint(document.title, document.content);
    blockedRef.current = false;
    setSaveState('saved');
  }, []);

  const inFlightRef = useRef<Promise<FlushResult> | null>(null);

  const performFlush = useCallback(async (): Promise<FlushResult> => {
    clearTimer();
    const payload = payloadRef.current;
    const updatedAt = updatedAtRef.current;
    if (!payload || !updatedAt || blockedRef.current) return blockedRef.current ? 'conflict' : 'idle';

    const nextFingerprint = fingerprint(payload.title, payload.content);
    if (!payload.title.trim() || nextFingerprint === savedFingerprintRef.current) {
      setSaveState('saved');
      return 'idle';
    }

    setSaveState('saving');
    try {
      const result = await projectDocumentsApiService.update(payload.documentId, {
        expected_updated_at: updatedAt,
        title: payload.title.trim(),
        content: payload.content,
      });
      if (payloadRef.current?.documentId !== payload.documentId) return 'idle';
      if (result.status === 'conflict') {
        blockedRef.current = true;
        setSaveState('conflict');
        onConflictRef.current(result.document);
        return 'conflict';
      }
      updatedAtRef.current = result.document.updated_at;
      savedFingerprintRef.current = fingerprint(result.document.title, result.document.content);
      setSaveState('saved');
      onSavedRef.current(result.document);
      return 'saved';
    } catch {
      if (payloadRef.current?.documentId === payload.documentId) {
        setSaveState('error');
      }
      return 'error';
    }
  }, []);

  // Saves run one at a time: a second save would reuse the old `updated_at` and conflict
  // with the first. Later calls wait, then save the latest payload with the new timestamp.
  const flush = useCallback(async (): Promise<FlushResult> => {
    clearTimer();
    while (inFlightRef.current) await inFlightRef.current;
    const run = performFlush();
    inFlightRef.current = run;
    try {
      return await run;
    } finally {
      if (inFlightRef.current === run) inFlightRef.current = null;
    }
  }, [performFlush]);

  const schedule = useCallback(
    (documentId: string, title: string, content: ISectionDocument) => {
      if (blockedRef.current) return;
      payloadRef.current = { documentId, title, content };
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        void flush();
      }, 800);
    },
    [flush]
  );

  const touchSaved = useCallback((updatedAt: string, title: string) => {
    updatedAtRef.current = updatedAt;
    const payload = payloadRef.current;
    if (!payload) return;
    const unchanged =
      fingerprint(payload.title, payload.content) === savedFingerprintRef.current ||
      fingerprint(title, payload.content) === savedFingerprintRef.current;
    payloadRef.current = { ...payload, title };
    if (unchanged) {
      savedFingerprintRef.current = fingerprint(title, payload.content);
    }
  }, []);

  const retry = useCallback(() => {
    if (blockedRef.current) return;
    void flush();
  }, [flush]);

  return { saveState, schedule, flush, retry, markClean, touchSaved };
};
