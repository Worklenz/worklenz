// TEST ONLY. Serves the app's real `fetch` calls from the in-memory fake API, so pages run unchanged through
// the production base query (RTK Query + fetchBaseQuery) and nothing test-specific lives in the app.
import { handleMockRequest } from './handlers';

const API_PREFIX = /^https?:\/\/[^/]+\/api\/client-portal/;

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const request = input instanceof Request ? input : new Request(String(input), init);
  const url = new URL(request.url);

  // The presigned storage URL a file is PUT to.
  if (url.hostname === 'files.test') return new Response(null, { status: 200 });

  const path = request.url.replace(API_PREFIX, '').split('?')[0];
  if (path === request.url.split('?')[0]) return json(404, { done: false, body: { code: 'NOT_FOUND' }, message: 'Unknown host' });

  const method = request.method.toUpperCase();
  let body: Record<string, unknown> = {};
  if (method !== 'GET' && method !== 'HEAD') {
    const text = await request.text();
    if (text) {
      try {
        const parsed: unknown = JSON.parse(text);
        if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>;
      } catch {
        body = {};
      }
    }
  }

  const result = handleMockRequest(method, path, url.searchParams, body);
  if (!result) return json(404, { done: false, body: { code: 'NOT_FOUND' }, message: 'Not found' });
  return json(result.status, result.body);
};
