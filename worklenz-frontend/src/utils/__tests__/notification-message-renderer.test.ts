import { renderNotificationMessage } from '../notification-message-renderer';

describe('renderNotificationMessage', () => {
  const mockT: any = (key: string, options?: any) => {
    if (key === 'taskAssigned') {
      return `<strong>${options?.reporter}</strong> has assigned you to <strong>${options?.task}</strong>`;
    }
    return options?.defaultValue || key;
  };

  it('renders translated message when message_key is provided', () => {
    const notification = {
      message_key: 'notifications.taskAssigned',
      message_params: { reporter: 'Alice', task: 'Mobile UI' },
      message: 'Fallback message',
    };

    const rendered = renderNotificationMessage(notification, mockT);
    expect(rendered).toBe('<strong>Alice</strong> has assigned you to <strong>Mobile UI</strong>');
  });

  it('falls back to raw message when message_key is missing', () => {
    const notification = {
      message: '<b>Bob</b> invited you to join <b>Engineering</b>',
    };

    const rendered = renderNotificationMessage(notification, mockT);
    expect(rendered).toBe('<b>Bob</b> invited you to join <b>Engineering</b>');
  });

  it('translates a legacy task-assignment message without a message key', () => {
    const notification = {
      message: '<b>Alice</b> has assigned you in <b>Mobile UI</b>',
    };

    const rendered = renderNotificationMessage(notification, mockT);

    expect(rendered).toBe('<strong>Alice</strong> has assigned you to <strong>Mobile UI</strong>');
  });

  it('sanitizes malicious script tags in raw message', () => {
    const notification = {
      message: '<b>Bob</b> <script>alert("hack")</script>',
    };

    const rendered = renderNotificationMessage(notification, mockT);
    expect(rendered).toBe('<b>Bob</b> ');
    expect(rendered).not.toContain('<script>');
  });

  it('returns empty string if neither message nor message_key is provided', () => {
    const notification = {};

    const rendered = renderNotificationMessage(notification, mockT);
    expect(rendered).toBe('');
  });
});
