import { afterEach, describe, expect, it, vi } from 'vitest';
import projectFilesApiService from './projects/project-files.api.service';
import taskAttachmentsApiService from './tasks/task-attachments.api.service';

vi.mock('./api-client', () => ({ default: {} }));

afterEach(() => vi.unstubAllGlobals());

describe.each([
  ['project files', projectFilesApiService.uploadDirect],
  ['task attachments', taskAttachmentsApiService.uploadDirect],
])('%s direct upload', (_name, uploadDirect) => {
  it.each([
    ['Azure', 'https://example.blob.core.windows.net/container/file?sv=2024-01-01&sr=b&sig=signed', true],
    ['S3', 'https://s3.example.com/bucket/file?X-Amz-Signature=signed', false],
  ])('sends the required headers to %s', async (_provider, url, isAzure) => {
    const headers: Record<string, string> = {};
    class MockRequest {
      status = 201;
      upload = { addEventListener: vi.fn() };
      private onLoad?: () => void;
      open = vi.fn();
      setRequestHeader = (name: string, value: string) => { headers[name] = value; };
      addEventListener = (event: string, callback: () => void) => {
        if (event === 'load') this.onLoad = callback;
      };
      send = () => this.onLoad?.();
    }
    vi.stubGlobal('XMLHttpRequest', MockRequest);

    await uploadDirect(url, new File(['image'], 'image.jpg', { type: 'image/jpeg' }));

    expect(headers['Content-Type']).toBe('image/jpeg');
    expect(headers['x-ms-blob-type']).toBe(isAzure ? 'BlockBlob' : undefined);
  });
});
