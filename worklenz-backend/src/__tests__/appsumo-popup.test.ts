/**
 * AppSumo promo popup cadence (issue #2354).
 *
 * jest.config.js sets automock: true, so the module under test is un-mocked explicitly and its
 * collaborators (db, log_error) are replaced with factories. No real database is touched.
 */
jest.mock('../config/db', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock('../shared/utils', () => ({
  log_error: jest.fn(),
}));

jest.unmock('../shared/appsumo-popup');

import db from '../config/db';
import { log_error } from '../shared/utils';
import { claimAppSumoPopupSlot, getAppSumoPopupFrequencyDays } from '../shared/appsumo-popup';

const mockedQuery = db.query as unknown as jest.Mock;
const mockedLogError = log_error as jest.Mock;

const ORIGINAL_FREQUENCY = process.env.APPSUMO_POPUP_FREQUENCY_DAYS;

const setFrequency = (value: string | undefined) => {
  if (value === undefined) delete process.env.APPSUMO_POPUP_FREQUENCY_DAYS;
  else process.env.APPSUMO_POPUP_FREQUENCY_DAYS = value;
};

afterAll(() => setFrequency(ORIGINAL_FREQUENCY));

describe('getAppSumoPopupFrequencyDays', () => {
  it.each([
    [undefined, 1],
    ['', 1],
    ['abc', 1],
    ['0', 1],
    ['-2', 1],
    ['1', 1],
    ['7', 7],
    ['3.9', 3],
  ])('APPSUMO_POPUP_FREQUENCY_DAYS=%p resolves to %p day(s)', (raw, expected) => {
    setFrequency(raw);

    expect(getAppSumoPopupFrequencyDays()).toBe(expected);
  });
});

describe('claimAppSumoPopupSlot', () => {
  beforeEach(() => {
    setFrequency(undefined);
  });

  it('claims through one atomic UPDATE using the user id and the env-configured interval', async () => {
    setFrequency('7');
    mockedQuery.mockResolvedValue({ rows: [{ should_show: true }], rowCount: 1 });

    await claimAppSumoPopupSlot('user-1');

    expect(mockedQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockedQuery.mock.calls[0];
    expect(params).toEqual(['user-1', 7]);
    expect(sql).toContain('UPDATE users');
    expect(sql).toContain('appsumo_popup_last_shown_at IS NULL');
    expect(sql).toContain('CURRENT_TIMESTAMP - make_interval(days => $2::int)');
  });

  it('defaults to a one day interval when the env var is not set', async () => {
    mockedQuery.mockResolvedValue({ rows: [{ should_show: true }], rowCount: 1 });

    await claimAppSumoPopupSlot('user-1');

    expect(mockedQuery.mock.calls[0][1]).toEqual(['user-1', 1]);
  });

  it('reports should_show true when the slot was claimed', async () => {
    mockedQuery.mockResolvedValue({ rows: [{ should_show: true }], rowCount: 1 });

    await expect(claimAppSumoPopupSlot('user-1')).resolves.toEqual({ should_show: true });
  });

  it('reports should_show false when the popup was already shown inside the interval', async () => {
    mockedQuery.mockResolvedValue({ rows: [{ should_show: false }], rowCount: 1 });

    await expect(claimAppSumoPopupSlot('user-1')).resolves.toEqual({ should_show: false });
  });

  it('never claims on an empty result', async () => {
    mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    await expect(claimAppSumoPopupSlot('user-1')).resolves.toEqual({ should_show: false });
  });

  it('returns null and logs to the console only (no Slack) when the query fails, e.g. before the migration', async () => {
    const error = Object.assign(new Error('column "appsumo_popup_last_shown_at" does not exist'), {
      code: '42703',
    });
    mockedQuery.mockRejectedValue(error);

    await expect(claimAppSumoPopupSlot('user-1')).resolves.toBeNull();

    // third argument is sendToSlack: it must be false so un-migrated databases don't page anyone
    expect(mockedLogError).toHaveBeenCalledWith(error, null, false);
  });
});
