import { useCallback, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import {
  ImportValidation,
  useValidateClientImportMutation,
} from '@/api/client-portal/company-users-api';
import { CsvParseError, checkCsvFile, parseCsvText } from './csv-import';
import type { WizardAction } from './wizard-state';

export type CsvRequestFailure = { kind: 'requestFailed'; message?: string };

const readFileText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

/**
 * Reads a chosen CSV, parses it in the browser and asks the server to check every row (a dry
 * run). The rows themselves live in the wizard state; this holds what the check found.
 */
export const useCsvImport = (dispatch: Dispatch<WizardAction>) => {
  const [validate, { isLoading: isChecking }] = useValidateClientImportMutation();
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<CsvParseError | CsvRequestFailure | null>(null);
  const [validation, setValidation] = useState<ImportValidation | null>(null);
  // A slow answer for an earlier file must not overwrite the file chosen after it.
  const latestRequest = useRef(0);

  const clear = useCallback(() => {
    latestRequest.current += 1;
    setError(null);
    setValidation(null);
    setIsReading(false);
    dispatch({ type: 'setCsv', fileName: null, rows: [] });
  }, [dispatch]);

  const chooseFile = useCallback(
    async (file: File) => {
      const requestId = latestRequest.current + 1;
      latestRequest.current = requestId;

      setError(null);
      setValidation(null);
      dispatch({ type: 'setCsv', fileName: null, rows: [] });

      const fileProblem = checkCsvFile(file);
      if (fileProblem) {
        setError(fileProblem);
        return;
      }

      setIsReading(true);
      let text: string;
      try {
        text = await readFileText(file);
      } catch {
        if (latestRequest.current !== requestId) return;
        setIsReading(false);
        setError({ kind: 'unreadable' });
        return;
      }
      if (latestRequest.current !== requestId) return;
      setIsReading(false);

      const parsed = parseCsvText(text);
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }

      dispatch({ type: 'setCsv', fileName: file.name, rows: parsed.rows });

      try {
        const result = await validate({ rows: parsed.rows }).unwrap();
        if (latestRequest.current !== requestId) return;
        setValidation(result.body);
      } catch (requestError) {
        if (latestRequest.current !== requestId) return;
        const message = (requestError as { data?: { message?: string } })?.data?.message;
        setError({ kind: 'requestFailed', message });
        dispatch({ type: 'setCsv', fileName: null, rows: [] });
      }
    },
    [dispatch, validate]
  );

  return {
    isBusy: isReading || isChecking,
    error,
    validation,
    chooseFile,
    clear,
  };
};
