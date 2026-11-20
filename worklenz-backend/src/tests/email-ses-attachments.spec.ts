const mockSesSend = jest.fn();
const mockSesV2Send = jest.fn();
const mockQuery = jest.fn();

jest.mock('@aws-sdk/client-ses', () => ({
  SESClient: jest.fn().mockImplementation(() => ({ send: mockSesSend })),
  SendEmailCommand: jest.fn().mockImplementation(input => ({ input })),
}));
jest.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: jest.fn().mockImplementation(() => ({ send: mockSesV2Send })),
  SendEmailCommand: jest.fn().mockImplementation(input => ({ input })),
}));
jest.mock('../config/db', () => ({ __esModule: true, default: { query: mockQuery } }));

const { sendEmailEnhanced } = require('../shared/email');

describe('SES email delivery', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv, AWS_REGION: 'us-west-2', EMAIL_PROVIDER: 'ses', EMAIL_FROM: 'Reports <reports@example.com>' };
    mockQuery.mockReset().mockResolvedValue({ rows: [] });
    mockSesSend.mockReset().mockResolvedValue({ MessageId: 'plain' });
    mockSesV2Send.mockReset().mockResolvedValue({ MessageId: 'attachment' });
  });
  afterAll(() => { process.env = originalEnv; });

  it('sends attachments through SESv2 with the configured sender and recipients', async () => {
    const result = await sendEmailEnhanced({ to: ['to@example.com'], cc: ['cc@example.com'], subject: 'Report', html: '<p>Report</p>', attachments: [{ filename: 'report.csv', content: 'a,b', contentType: 'text/csv' }] });
    expect(result).toEqual({ success: true, messageId: 'attachment' });
    expect(mockSesSend).not.toHaveBeenCalled();
    expect(mockSesV2Send).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({
      FromEmailAddress: 'Reports <reports@example.com>',
      Destination: { ToAddresses: ['to@example.com'], CcAddresses: ['cc@example.com'] },
      Content: expect.objectContaining({ Simple: expect.objectContaining({ Attachments: [expect.objectContaining({ FileName: 'report.csv', RawContent: Buffer.from('a,b') })] }) }),
    }) }));
  });

  it('sends CC without requiring raw email permissions', async () => {
    const result = await sendEmailEnhanced({ to: ['to@example.com'], cc: ['cc@example.com'], subject: 'Report', html: '<p>Report</p>' });
    expect(result.success).toBe(true);
    expect(mockSesV2Send).not.toHaveBeenCalled();
    expect(mockSesSend).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ Destination: { ToAddresses: ['to@example.com'], CcAddresses: ['cc@example.com'] } }) }));
  });
});
