import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string; emoji?: string }) => {
      let val = options?.defaultValue ?? _key;
      if (options?.emoji) val = val.replace('{{emoji}}', options.emoji);
      return val;
    },
  }),
}));

import { MessageReactions } from '../MessageReactions';
import type { ClientThreadMessageReactionV2 } from '@/types/v2';

describe('MessageReactions', () => {
  const sampleReactions: ClientThreadMessageReactionV2[] = [
    {
      emoji: '👍',
      count: 2,
      has_reacted: true,
      users: [
        { id: 'u1', name: 'Alex Chen', side: 'client' },
        { id: 'u2', name: 'Kasun F.', side: 'internal' },
      ],
    },
    {
      emoji: '❤️',
      count: 1,
      has_reacted: false,
      users: [{ id: 'u3', name: 'Nimesh S.', side: 'internal' }],
    },
  ];

  it('renders reaction badges with correct counts and emojis', () => {
    const onToggle = vi.fn();
    render(
      <MessageReactions
        messageId="msg-1"
        reactions={sampleReactions}
        canReact={true}
        onToggleReaction={onToggle}
      />
    );

    expect(screen.getByText('👍')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('❤️')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('indicates aria-pressed correctly based on has_reacted', () => {
    const onToggle = vi.fn();
    render(
      <MessageReactions
        messageId="msg-1"
        reactions={sampleReactions}
        canReact={true}
        onToggleReaction={onToggle}
      />
    );

    const thumbsBtn = screen.getByLabelText('👍 2');
    expect(thumbsBtn).toHaveAttribute('aria-pressed', 'true');

    const heartBtn = screen.getByLabelText('❤️ 1');
    expect(heartBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onToggleReaction when a reaction badge is clicked by an authorized user', () => {
    const onToggle = vi.fn();
    render(
      <MessageReactions
        messageId="msg-1"
        reactions={sampleReactions}
        canReact={true}
        onToggleReaction={onToggle}
      />
    );

    const thumbsBtn = screen.getByLabelText('👍 2');
    fireEvent.click(thumbsBtn);
    expect(onToggle).toHaveBeenCalledWith('msg-1', '👍');
  });

  it('does not trigger onToggleReaction when canReact is false (Viewer role)', () => {
    const onToggle = vi.fn();
    render(
      <MessageReactions
        messageId="msg-1"
        reactions={sampleReactions}
        canReact={false}
        onToggleReaction={onToggle}
      />
    );

    const thumbsBtn = screen.getByLabelText('👍 2');
    expect(thumbsBtn).toBeDisabled();
    fireEvent.click(thumbsBtn);
    expect(onToggle).not.toHaveBeenCalled();

    // Add reaction button should not be rendered
    expect(screen.queryByLabelText('Add reaction')).not.toBeInTheDocument();
  });

  it('opens emoji popover and allows selecting a reaction', () => {
    const onToggle = vi.fn();
    render(
      <MessageReactions
        messageId="msg-1"
        reactions={sampleReactions}
        canReact={true}
        onToggleReaction={onToggle}
      />
    );

    const addBtn = screen.getByLabelText('Add reaction');
    expect(addBtn).toBeInTheDocument();
    fireEvent.click(addBtn);

    // Click on celebration emoji
    const celebrateBtn = screen.getByLabelText('🎉');
    expect(celebrateBtn).toBeInTheDocument();
    fireEvent.click(celebrateBtn);

    expect(onToggle).toHaveBeenCalledWith('msg-1', '🎉');
  });
});
