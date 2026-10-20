import { useEffect, useRef } from 'react';
import { FormInstance } from '@/shared/antd-imports';

import { progressTrackingApiService } from '@/api/reporting/progress-tracking.api.service';
import logger from '@/utils/errorLogger';

export type SavedConfidence = { status: 'green' | 'amber' | 'red' | null; note: string | null };

/**
 * Loads the project's delivery confidence into the form while the modal is open and keeps the
 * last saved value, so the submit handler only calls the API when it actually changed.
 */
export const useDeliveryConfidence = (
  form: FormInstance,
  modalVisible: boolean,
  projectId: string | null
) => {
  const savedConfidenceRef = useRef<SavedConfidence>({ status: null, note: null });
  const confidenceLoadedRef = useRef(false);

  useEffect(() => {
    if (!modalVisible || !projectId) {
      confidenceLoadedRef.current = false;
      return;
    }

    let cancelled = false;
    confidenceLoadedRef.current = false;

    const loadConfidence = async () => {
      try {
        const response = await progressTrackingApiService.getConfidence(projectId);
        if (cancelled || !response.done || !response.body) return;
        const status = response.body.confidence;
        const note = response.body.confidence_note;
        savedConfidenceRef.current = { status, note };
        confidenceLoadedRef.current = true;
        form.setFieldsValue({
          delivery_confidence: status ?? 'unset',
          delivery_confidence_note: note ?? '',
        });
      } catch (error) {
        logger.error('Error loading delivery confidence', error);
      }
    };

    void loadConfidence();
    return () => {
      cancelled = true;
    };
  }, [form, modalVisible, projectId]);

  return { savedConfidenceRef, confidenceLoadedRef };
};
