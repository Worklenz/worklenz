import { AxiosError } from 'axios';

import apiClient from '@/api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { RoadmapExportPayload } from '../utils/roadmap-export';

const parseFileName = (header: string | undefined, fallback: string): string => {
  if (!header) return fallback;
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim());
    } catch {
      return utfMatch[1].trim();
    }
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(header);
  return plainMatch?.[1]?.trim() || fallback;
};

const readError = async (blob: Blob): Promise<string | null> => {
  try {
    const parsed = JSON.parse(await blob.text()) as { message?: string };
    return parsed.message || null;
  } catch {
    return null;
  }
};

export const exportRoadmapFile = async (
  payload: RoadmapExportPayload
): Promise<{ blob: Blob; fileName: string }> => {
  const fallback = payload.format === 'pdf' ? 'Roadmap.pdf' : 'Roadmap.xlsx';
  try {
    const response = await apiClient.post(`${API_BASE_URL}/roadmap/export`, payload, {
      responseType: 'blob',
    });
    const blob = response.data as Blob;
    const type = (blob.type || '').toLowerCase();
    if (type.includes('application/json') || type.includes('text/json')) {
      throw new Error((await readError(blob)) || 'Could not export the roadmap.');
    }
    const fileName = parseFileName(
      response.headers?.['content-disposition'] as string | undefined,
      fallback
    );
    return { blob, fileName };
  } catch (error) {
    if (error instanceof AxiosError && error.response?.data instanceof Blob) {
      const message = await readError(error.response.data);
      throw new Error(message || 'Could not export the roadmap.');
    }
    throw error;
  }
};
