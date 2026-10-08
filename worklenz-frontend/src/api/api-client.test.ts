import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AxiosAdapter, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const mockAlertService = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));

vi.mock('@/services/alerts/alertService', () => ({ default: mockAlertService }));
vi.mock('@/utils/errorLogger', () => ({ default: { error: vi.fn() } }));
vi.mock('@/config/env', () => ({ default: { apiUrl: 'http://api.test' } }));
vi.mock('@/services/invitation-redirect.service', () => ({
  invitationRedirectService: { storePendingInvitation: vi.fn() },
}));

const CSRF_ERROR_BODY = { done: false, message: 'Invalid CSRF token' };
const PERMISSION_ERROR_BODY = {
  done: false,
  body: null,
  message: "You do not have permission to modify this task. Only non-guest members of the task's team can make changes.",
};
const ORIGINAL_HREF = 'http://localhost/worklenz/reporting/overview';

interface LoadedClient {
  apiClient: AxiosInstance;
  axiosGet: ReturnType<typeof vi.fn>;
  AxiosError: typeof import('axios').AxiosError;
}

const loadClient = async (): Promise<LoadedClient> => {
  vi.resetModules();
  const axiosModule = await import('axios');
  const axiosGet = vi
    .spyOn(axiosModule.default, 'get')
    .mockResolvedValue({ data: { token: 'fresh-token' }, headers: {} });
  const { default: apiClient } = await import('./api-client');
  return { apiClient, axiosGet: axiosGet as unknown as ReturnType<typeof vi.fn>, AxiosError: axiosModule.AxiosError };
};

const forbidden = (
  AxiosError: LoadedClient['AxiosError'],
  config: InternalAxiosRequestConfig,
  data: unknown
) =>
  Promise.reject(
    new AxiosError('Request failed with status code 403', 'ERR_BAD_REQUEST', config, null, {
      status: 403,
      statusText: 'Forbidden',
      data,
      headers: {},
      config,
    } as AxiosResponse)
  );

const ok = (config: InternalAxiosRequestConfig, data: unknown): Promise<AxiosResponse> =>
  Promise.resolve({ status: 200, statusText: 'OK', data, headers: {}, config });

const alertTitles = () => mockAlertService.error.mock.calls.map(([title]) => title);

describe('apiClient CSRF retry handling', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.values(mockAlertService).forEach(fn => fn.mockReset());
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { href: ORIGINAL_HREF, pathname: '/worklenz/reporting/overview' },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
    vi.restoreAllMocks();
  });

  it('retries a CSRF 403 with a refreshed token and resolves when the retry succeeds', async () => {
    const { apiClient, axiosGet, AxiosError } = await loadClient();
    const adapter = vi
      .fn<AxiosAdapter>()
      .mockImplementationOnce(config => forbidden(AxiosError, config, CSRF_ERROR_BODY))
      .mockImplementationOnce(config => ok(config, { done: true, body: null }));
    apiClient.defaults.adapter = adapter;

    const response = await apiClient.delete('/api/v1/tasks/task-1');

    expect(response.data.done).toBe(true);
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(axiosGet).toHaveBeenCalledTimes(2);
    expect(adapter.mock.calls[1][0].headers['X-CSRF-Token']).toBe('fresh-token');
    expect(window.location.href).toBe(ORIGINAL_HREF);
  });

  it('keeps the user on the page when the retry fails with a permission 403', async () => {
    const { apiClient, AxiosError } = await loadClient();
    const adapter = vi
      .fn<AxiosAdapter>()
      .mockImplementationOnce(config => forbidden(AxiosError, config, CSRF_ERROR_BODY))
      .mockImplementationOnce(config => forbidden(AxiosError, config, PERMISSION_ERROR_BODY));
    apiClient.defaults.adapter = adapter;

    await expect(apiClient.delete('/api/v1/tasks/task-1')).rejects.toMatchObject({
      response: { status: 403, data: PERMISSION_ERROR_BODY },
    });

    expect(adapter).toHaveBeenCalledTimes(2);
    expect(window.location.href).toBe(ORIGINAL_HREF);
    expect(alertTitles()).toEqual(['Access Denied']);
    expect(mockAlertService.error).toHaveBeenCalledWith('Access Denied', PERMISSION_ERROR_BODY.message);
  });

  it('redirects to login when the CSRF token is still rejected after retrying', async () => {
    const { apiClient, AxiosError } = await loadClient();
    const adapter = vi
      .fn<AxiosAdapter>()
      .mockImplementation(config => forbidden(AxiosError, config, CSRF_ERROR_BODY));
    apiClient.defaults.adapter = adapter;

    await expect(apiClient.delete('/api/v1/tasks/task-1')).rejects.toMatchObject({
      response: { status: 403 },
    });

    expect(window.location.href).toBe('/auth/login');
    expect(alertTitles()).toContain('Security Error');
  });

  it('does not retry or redirect on a first-attempt permission 403', async () => {
    const { apiClient, AxiosError } = await loadClient();
    const adapter = vi
      .fn<AxiosAdapter>()
      .mockImplementation(config => forbidden(AxiosError, config, PERMISSION_ERROR_BODY));
    apiClient.defaults.adapter = adapter;

    await expect(apiClient.delete('/api/v1/tasks/task-1')).rejects.toMatchObject({
      response: { status: 403 },
    });

    expect(adapter).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe(ORIGINAL_HREF);
    expect(alertTitles()).toEqual(['Access Denied']);
  });

  it('does not alert on a permission 403 for an X-Silent-Request call', async () => {
    const { apiClient, AxiosError } = await loadClient();
    const adapter = vi
      .fn<AxiosAdapter>()
      .mockImplementation(config => forbidden(AxiosError, config, PERMISSION_ERROR_BODY));
    apiClient.defaults.adapter = adapter;

    await expect(
      apiClient.post('/api/v1/tasks', {}, { headers: { 'X-Silent-Request': '1' } })
    ).rejects.toMatchObject({ response: { status: 403, data: PERMISSION_ERROR_BODY } });

    expect(adapter).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe(ORIGINAL_HREF);
    expect(mockAlertService.error).not.toHaveBeenCalled();
  });

  it('keeps the silent opt-out when a CSRF retry of a silent call fails with a permission 403', async () => {
    const { apiClient, AxiosError } = await loadClient();
    const adapter = vi
      .fn<AxiosAdapter>()
      .mockImplementationOnce(config => forbidden(AxiosError, config, CSRF_ERROR_BODY))
      .mockImplementationOnce(config => forbidden(AxiosError, config, PERMISSION_ERROR_BODY));
    apiClient.defaults.adapter = adapter;

    await expect(
      apiClient.post('/api/v1/tasks', {}, { headers: { 'X-Silent-Request': '1' } })
    ).rejects.toMatchObject({ response: { status: 403, data: PERMISSION_ERROR_BODY } });

    expect(adapter).toHaveBeenCalledTimes(2);
    expect(adapter.mock.calls[1][0].headers['X-Silent-Request']).toBe('1');
    expect(window.location.href).toBe(ORIGINAL_HREF);
    expect(mockAlertService.error).not.toHaveBeenCalled();
  });

  it('still forces re-login for a silent call whose CSRF token keeps being rejected', async () => {
    const { apiClient, AxiosError } = await loadClient();
    apiClient.defaults.adapter = vi
      .fn<AxiosAdapter>()
      .mockImplementation(config => forbidden(AxiosError, config, CSRF_ERROR_BODY));

    await expect(
      apiClient.post('/api/v1/tasks', {}, { headers: { 'X-Silent-Request': '1' } })
    ).rejects.toMatchObject({ response: { status: 403 } });

    expect(window.location.href).toBe('/auth/login');
    expect(alertTitles()).toContain('Security Error');
  });
});
