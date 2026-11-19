import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClientPortalRealtimeSync } from './useClientPortalRealtimeSync';
import { CLIENT_PORTAL_SOCKET } from '@/shared/client-portal-socket';
import { SocketEvents } from '@/shared/socket-events';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: never[]) => void>(),
  dispatch: vi.fn(),
  invalidate: vi.fn((tags: string[]) => ({ type: 'invalidate', payload: tags })),
  socket: { connected: true, on: vi.fn(), off: vi.fn(), emit: vi.fn() },
}));
vi.mock('@/socket/socketContext', () => ({ useSocket: () => ({ socket: mocks.socket }) }));
vi.mock('./useAppDispatch', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('@/api/client-portal/client-portal-api', () => ({
  clientPortalApi: { util: { invalidateTags: mocks.invalidate } },
}));

describe('client portal realtime sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.handlers.clear();
    mocks.socket.on.mockImplementation((event: string, handler: (...args: never[]) => void) => {
      mocks.handlers.set(event, handler);
    });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it.each([
    ['access update', CLIENT_PORTAL_SOCKET.DATA_UPDATED, { type: 'access' }],
    ['access notification', SocketEvents.NOTIFICATIONS_UPDATE.toString(), { notification_type_key: 'CLIENT_PORTAL_ACCESS' }],
  ])('refreshes client users on an %s', (_label, event, payload) => {
    renderHook(() => useClientPortalRealtimeSync());
    act(() => {
      mocks.handlers.get(event)?.(payload as never);
      vi.advanceTimersByTime(200);
    });
    expect(mocks.invalidate).toHaveBeenCalledWith(expect.arrayContaining(['PortalClientUsers']));
  });

  it('refreshes client users on reconnect', () => {
    renderHook(() => useClientPortalRealtimeSync());
    act(() => {
      mocks.handlers.get('connect')?.();
      vi.advanceTimersByTime(200);
    });
    expect(mocks.invalidate).toHaveBeenCalledWith(expect.arrayContaining(['PortalClientUsers']));
  });
});
