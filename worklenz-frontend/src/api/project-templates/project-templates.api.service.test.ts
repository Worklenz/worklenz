import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { ICustomProjectTemplateCreateRequest } from '@/types/project/projectTemplate.types';

const mockAlertService = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));

vi.mock('@/services/alerts/alertService', () => ({ default: mockAlertService }));
vi.mock('@/utils/errorLogger', () => ({ default: { error: vi.fn() } }));
vi.mock('@/config/env', () => ({ default: { apiUrl: 'http://api.test' } }));
vi.mock('@/shared/constants', () => ({ API_BASE_URL: '/api/v1' }));
vi.mock('@/services/invitation-redirect.service', () => ({
  invitationRedirectService: { storePendingInvitation: vi.fn() },
}));

const CREATE_BODY: ICustomProjectTemplateCreateRequest = {
  project_id: 'project-1',
  templateName: 'Alpha template',
  projectIncludes: { statuses: true, phases: true, labels: true, customColumns: false },
  taskIncludes: {
    status: true,
    phase: true,
    labels: true,
    estimation: true,
    description: true,
    subtasks: true,
  },
};

const ok = (config: InternalAxiosRequestConfig, data: unknown): Promise<AxiosResponse> =>
  Promise.resolve({ status: 200, statusText: 'OK', data, headers: {}, config });

const loadService = async () => {
  vi.resetModules();
  const axiosModule = await import('axios');
  vi.spyOn(axiosModule.default, 'get').mockResolvedValue({
    data: { token: 'csrf-token' },
    headers: {},
  });
  const { default: apiClient } = await import('../api-client');
  const { projectTemplatesApiService } = await import('./project-templates.api.service');
  return { apiClient, projectTemplatesApiService };
};

describe('projectTemplatesApiService.createCustomTemplate', () => {
  beforeEach(() => {
    Object.values(mockAlertService).forEach(fn => fn.mockReset());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts the template with X-Silent-Request: 1 and returns the server body', async () => {
    const { apiClient, projectTemplatesApiService } = await loadService();
    const serverBody = { done: true, body: { id: 'tpl-1' }, message: 'Template created' };
    const adapter = vi.fn<AxiosAdapter>().mockImplementation(config => ok(config, serverBody));
    apiClient.defaults.adapter = adapter;

    const result = await projectTemplatesApiService.createCustomTemplate(CREATE_BODY);

    expect(result).toEqual(serverBody);
    expect(adapter).toHaveBeenCalledTimes(1);
    const [config] = adapter.mock.calls[0];
    expect(config.method).toBe('post');
    expect(config.url).toMatch(/\/project-templates\/custom-template$/);
    expect(config.headers['X-Silent-Request']).toBe('1');
    expect(JSON.parse(config.data as string)).toEqual(CREATE_BODY);
  });

  it('does not let the shared API client raise its own alert for a successful create', async () => {
    const { apiClient, projectTemplatesApiService } = await loadService();
    apiClient.defaults.adapter = vi
      .fn<AxiosAdapter>()
      .mockImplementation(config =>
        ok(config, { done: true, title: 'Success', message: 'Template created' })
      );

    await projectTemplatesApiService.createCustomTemplate(CREATE_BODY);

    expect(mockAlertService.success).not.toHaveBeenCalled();
    expect(mockAlertService.error).not.toHaveBeenCalled();
  });

  it('does not let the shared API client raise its own alert for a { done: false } create', async () => {
    const { apiClient, projectTemplatesApiService } = await loadService();
    apiClient.defaults.adapter = vi
      .fn<AxiosAdapter>()
      .mockImplementation(config =>
        ok(config, { done: false, title: 'Error', message: 'Template name already exists' })
      );

    const result = await projectTemplatesApiService.createCustomTemplate(CREATE_BODY);

    expect(result.done).toBe(false);
    expect(mockAlertService.success).not.toHaveBeenCalled();
    expect(mockAlertService.error).not.toHaveBeenCalled();
  });

  it('rejects a 403 create without the shared API client raising its own alert', async () => {
    const { apiClient, projectTemplatesApiService } = await loadService();
    const { AxiosError } = await import('axios');
    const forbiddenBody = { done: false, body: null, message: 'You are not allowed to create templates' };
    const adapter = vi.fn<AxiosAdapter>().mockImplementation(config =>
      Promise.reject(
        new AxiosError('Request failed with status code 403', 'ERR_BAD_REQUEST', config, null, {
          status: 403,
          statusText: 'Forbidden',
          data: forbiddenBody,
          headers: {},
          config,
        } as AxiosResponse)
      )
    );
    apiClient.defaults.adapter = adapter;

    await expect(projectTemplatesApiService.createCustomTemplate(CREATE_BODY)).rejects.toMatchObject({
      response: { status: 403, data: forbiddenBody },
    });

    expect(adapter).toHaveBeenCalledTimes(1);
    expect(mockAlertService.success).not.toHaveBeenCalled();
    expect(mockAlertService.error).not.toHaveBeenCalled();
  });
});
