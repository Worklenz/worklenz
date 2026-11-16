import { Server, Socket } from 'socket.io';
import { on_quick_task } from '../socket.io/commands/on-quick-task';
import { SocketEvents } from '../socket.io/events';

describe('quick task responses', () => {
  it('sends failures only to the request acknowledgement when provided', async () => {
    const emit = jest.fn();
    const acknowledge = jest.fn();
    await on_quick_task({} as Server, { emit } as unknown as Socket, JSON.stringify({ name: '' }), acknowledge);
    expect(acknowledge).toHaveBeenCalledWith(null);
    expect(emit).not.toHaveBeenCalled();
  });

  it('preserves the legacy response event for existing callers', async () => {
    const emit = jest.fn();
    await on_quick_task({} as Server, { emit } as unknown as Socket, JSON.stringify({ name: '' }));
    expect(emit).toHaveBeenCalledWith(SocketEvents.QUICK_TASK.toString(), null);
  });
});
