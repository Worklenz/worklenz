import { Blob as NodeBlob } from "node:buffer";
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { unzipSync } from 'fflate';
import { exportRoadmapFile } from './roadmap-export.api';
import apiClient from '@/api/api-client';
import type { RoadmapExportPayload, RoadmapExportRowPayload } from '../utils/roadmap-export';

vi.mock('@/api/api-client', () => ({ default: { post: vi.fn() } }));
const row = (index: number): RoadmapExportRowPayload => ({
  kind: 'task', name: `Task ${index}`, group: '', startDate: null, endDate: null,
  progress: null, status: '', priority: '', assignees: '', dependencies: '', parent: '', color: null,
});
const payload = (count: number): RoadmapExportPayload => ({
  project_id: 'project', format: 'pdf', group_by: 'phase', grouping_label: 'Phase',
  rows: Array.from({ length: count }, (_, index) => row(index)),
});
describe('roadmap export downloads', () => {
  beforeEach(() => {
    vi.stubGlobal("Blob", NodeBlob);
    vi.mocked(apiClient.post).mockReset().mockImplementation(async (_url, body) => ({
      data: new Blob([JSON.stringify((body as RoadmapExportPayload).rows.map(item => item.name))], { type: 'application/pdf' }),
      headers: { 'content-disposition': 'attachment; filename="Roadmap.pdf"' },
    }));
  });
  it('downloads small exports directly', async () => {
    const result = await exportRoadmapFile(payload(500));
    expect(result.fileName).toBe('Roadmap.pdf');
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });
  it('archives sequentially rendered parts without dropping rows', async () => {
    const result = await exportRoadmapFile(payload(1001));
    expect(result.fileName).toBe('Roadmap.zip');
    expect(apiClient.post).toHaveBeenCalledTimes(3);
    const files = unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
    expect(Object.keys(files)).toEqual(['Roadmap - 1.pdf', 'Roadmap - 2.pdf', 'Roadmap - 3.pdf']);
    const names = Object.values(files).flatMap(file => JSON.parse(new TextDecoder().decode(file)) as string[]);
    expect(names).toEqual(payload(1001).rows.map(item => item.name));
  });
});
