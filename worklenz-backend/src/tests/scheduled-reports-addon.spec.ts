const mockQuery = jest.fn();
const mockRelease = jest.fn();
const mockSendEmailEnhanced = jest.fn();
const mockResolveOrganizationContext = jest.fn();
const mockExportMembersCsv = jest.fn();
const mockExportAllocationCsv = jest.fn();
const mockExportAllTasksCsv = jest.fn();

jest.mock('@worklenz/addon-sdk', () => ({
  db: { pool: { connect: async () => ({ query: mockQuery, release: mockRelease }) } },
  log_error: jest.fn(), sendEmailEnhanced: mockSendEmailEnhanced,
}), { virtual: true });
jest.mock('../../../addons/worklenz-addons/scheduled-reports/backend/feed-export.service', () => ({
  FeedExportService: { resolveOrganizationContext: mockResolveOrganizationContext, exportMembersCsv: mockExportMembersCsv, exportAllocationCsv: mockExportAllocationCsv, exportAllTasksCsv: mockExportAllTasksCsv },
}), { virtual: true });
const fs = require('fs');
const path = require('path');
const hasAddon = fs.existsSync(path.resolve(__dirname, '../../../addons/worklenz-addons/scheduled-reports/backend/scheduler.ts')) || fs.existsSync(path.resolve(__dirname, '../../../addons/worklenz-addons/scheduled-reports/backend/scheduler.js'));
const runScheduledReports = hasAddon ? require('../../../addons/worklenz-addons/scheduled-reports/backend/scheduler').runScheduledReports : undefined;

(hasAddon ? describe : describe.skip)('scheduled reports delivery', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['performance'] }).setSystemTime(new Date('2026-11-06T01:00:00Z'));
    mockQuery.mockReset(); mockRelease.mockReset(); mockSendEmailEnhanced.mockReset();
    mockResolveOrganizationContext.mockReset(); mockExportMembersCsv.mockReset(); mockExportAllocationCsv.mockReset(); mockExportAllTasksCsv.mockReset();
    mockResolveOrganizationContext.mockResolvedValue({ organizationId: 'org' });
    for (const mock of [mockExportMembersCsv, mockExportAllocationCsv, mockExportAllTasksCsv]) mock.mockResolvedValue({ filename: 'report.csv', csvContent: 'header\nvalue', rowCount: 1 });
  });
  afterEach(() => jest.useRealTimers());
  const schedule = { id: 'id', organization_id: 'org', recipients: ['user@example.com'], subject: 'Reports', timezone: 'Asia/Colombo', start_date: '2026-04-01' };
  it('sends reports for the local date window and records success', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ locked: true }] }).mockResolvedValueOnce({ rows: [schedule] })
      .mockResolvedValueOnce({ rowCount: 0 }).mockResolvedValueOnce({ rows: [{ id: 'run' }] })
      .mockResolvedValueOnce({}).mockResolvedValueOnce({});
    mockSendEmailEnhanced.mockResolvedValue({ success: true, messageId: 'message' });
    await runScheduledReports();
    expect(mockExportAllTasksCsv).toHaveBeenCalledWith(expect.anything(), ['2026-04-01', '2026-11-05'], expect.anything());
    expect(mockSendEmailEnhanced).toHaveBeenCalledWith(expect.objectContaining({ to: ['user@example.com'], attachments: expect.arrayContaining([expect.objectContaining({ filename: 'report.csv' })]) }));
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("UPDATE scheduled_report_feed_logs SET status = 'SUCCESS'"), ['message', ['report.csv', 'report.csv', 'report.csv'], 36, 'run']);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('FROM scheduled_report_feeds WHERE is_active'), expect.any(Array));
    expect(mockRelease).toHaveBeenCalled();
  });
  it('does not resend a pending or successful run', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ locked: true }] }).mockResolvedValueOnce({ rows: [schedule] }).mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValueOnce({});
    await runScheduledReports();
    expect(mockSendEmailEnhanced).not.toHaveBeenCalled();
    expect(mockExportAllTasksCsv).not.toHaveBeenCalled();
  });
  it('keeps an uncertain delivery pending to prevent duplicate mail', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ locked: true }] }).mockResolvedValueOnce({ rows: [schedule] }).mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ id: 'run' }] }).mockResolvedValueOnce({}).mockResolvedValueOnce({});
    mockSendEmailEnhanced.mockResolvedValue({ success: false, error: { message: 'connection lost' } });
    await runScheduledReports();
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('SET error_details'), [expect.stringContaining('connection lost'), 'run']);
    expect(mockQuery).not.toHaveBeenCalledWith(expect.stringContaining("status = 'SUCCESS'"), expect.anything());
  });
});
