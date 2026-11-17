jest.mock('../config/db', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../services/roadmap/roadmap-export-runner', () => ({
  RoadmapExportBusyError: class RoadmapExportBusyError extends Error {},
  runRoadmapExport: jest.fn(),
}));
import { EventEmitter } from 'events';
import db from '../config/db';
import GanttController from '../controllers/gantt-controller';
import { RoadmapExportBusyError, runRoadmapExport } from '../services/roadmap/roadmap-export-runner';
import { createMockRequest, createMockResponse } from './utils/express-mock';

const runner = runRoadmapExport as jest.Mock;
const query = db.query as jest.Mock;
const request = () => createMockRequest({ body: { project_id: 'project-id', format: 'pdf', group_by: 'phase', rows: [] } });
const response = () => Object.assign(new EventEmitter(), createMockResponse());

describe('roadmap export controller', () => {
  beforeEach(() => { runner.mockReset(); query.mockReset().mockResolvedValue({ rows: [{ name: 'Project' }] }); });

  it('returns a retryable response when workers are busy', async () => {
    runner.mockRejectedValue(new RoadmapExportBusyError());
    const res = response();
    await GanttController.exportRoadmap(request(), res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '5');
  });

  it('returns the worker-generated file with its original content type', async () => {
    runner.mockResolvedValue(Buffer.from('%PDF-'));
    const res = response();
    await GanttController.exportRoadmap(request(), res);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.end).toHaveBeenCalledWith(Buffer.from('%PDF-'));
    expect(runner).toHaveBeenCalledWith('user-123', 'project-id', expect.objectContaining({ projectName: 'Project' }), expect.any(AbortSignal));
  });
});
