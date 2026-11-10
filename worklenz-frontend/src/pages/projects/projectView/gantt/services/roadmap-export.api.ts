import { AxiosError } from 'axios';
import { zip } from 'fflate';

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

const exportRoadmapPart = async (
  payload: RoadmapExportPayload
): Promise<{ blob: Blob; fileName: string }> => {
  const fallback = payload.format === 'pdf' ? 'Roadmap.pdf' : 'Roadmap.xlsx';
  try {
    const response = await apiClient.post(`${API_BASE_URL}/roadmap/export`, payload, {
      responseType: 'blob',
      headers: { 'X-Silent-Request': '1' },
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

// Each server render stays within its synchronous row limit. Larger roadmaps
// are downloaded as one archive containing consecutively numbered parts.
export const exportRoadmapFile = async (
  payload: RoadmapExportPayload
): Promise<{ blob: Blob; fileName: string }> => {
  const rowsPerPart = 500;
  if (payload.rows.length <= rowsPerPart) return exportRoadmapPart(payload);

  const files: Record<string, Uint8Array> = {};
  const dates = payload.rows.flatMap(row => [row.startDate, row.endDate]).filter((date): date is string => Boolean(date)).sort();
  const parts: RoadmapExportPayload['rows'][] = [];
  let group: RoadmapExportPayload['rows'][number] | undefined;
  let parent: RoadmapExportPayload['rows'][number] | undefined;
  let part: RoadmapExportPayload['rows'] = [];
  for (const row of payload.rows) {
    if (part.length === rowsPerPart) {
      parts.push(part);
      part = row.kind !== 'group' && group ? [group] : [];
      if (row.kind === 'subtask' && parent) part.push(parent);
    }
    if (row.kind === 'group') { group = row; parent = undefined; }
    if (row.kind === 'task') parent = row;
    part.push(row);
  }
  if (part.length) parts.push(part);
  const partCount = parts.length;
  let archiveName = 'Roadmap.zip';
  for (let index = 0; index < partCount; index += 1) {
    const part = await exportRoadmapPart({
      ...payload,
      rows: parts[index],
      timeline_start: dates[0],
      timeline_end: dates[dates.length - 1],
    });
    const base = part.fileName.replace(/\.(pdf|xlsx)$/i, '');
    archiveName = `${base}.zip`;
    files[`${base} - ${String(index + 1).padStart(String(partCount).length, '0')}.${payload.format}`] =
      new Uint8Array(await part.blob.arrayBuffer());
  }
  const archive = await new Promise<Uint8Array>((resolve, reject) => {
    zip(files, { level: 0 }, (error, result) => error ? reject(error) : resolve(result));
  });
  return { blob: new Blob([archive as BlobPart], { type: 'application/zip' }), fileName: archiveName };
};
