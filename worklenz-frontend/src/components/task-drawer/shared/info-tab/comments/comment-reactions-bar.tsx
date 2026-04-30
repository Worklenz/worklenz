import { useState } from 'react';
import { Popover, Tooltip, SmileOutlined } from '@/shared/antd-imports';
import { ITaskCommentViewModel, ReactionType } from '@/types/tasks/task-comments.types';
import { useAuthService } from '@/hooks/useAuth';
import { useAppSelector } from '@/hooks/useAppSelector';
import { REACTION_CONFIGS } from '@/shared/reaction-config';
import './comment-reactions-bar.css';

interface CommentReactionsBarProps {
  comment: ITaskCommentViewModel;
  onReactionClick: (reactionType: ReactionType) => void;
}

// Create emoji map from config for quick lookup
const REACTION_EMOJIS = REACTION_CONFIGS.reduce((acc, config) => {
  acc[config.type] = config.emoji;
  return acc;
}, {} as Record<ReactionType, string>);

const CommentReactionsBar = ({ comment, onReactionClick }: CommentReactionsBarProps) => {
  const [pickerVisible, setPickerVisible] = useState(false);
  const auth = useAuthService();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const teamMemberId = auth.getCurrentSession()?.team_member_id;

  // Check if user has already reacted with this type
  const hasUserReacted = (reactionType: ReactionType): boolean => {
    if (!teamMemberId || !comment?.reactions) return false;
    return comment.reactions[reactionType]?.reacted_member_ids?.includes(teamMemberId) || false;
  };

  // Check if user has reacted with any type
  const hasUserReactedToAny = (): boolean => {
    if (!teamMemberId || !comment?.reactions) return false;
    return REACTION_CONFIGS.some(config => hasUserReacted(config.type));
  };

  // Get available reactions (not yet reacted by user)
  const availableReactions = REACTION_CONFIGS.filter(config => !hasUserReacted(config.type));

  // Get existing reactions with counts
  const existingReactions = comment.reactions
    ? Object.entries(comment.reactions)
        .filter(([_, details]) => details.count > 0)
        .map(([type, details]) => ({
          type: type as ReactionType,
          emoji: REACTION_EMOJIS[type as ReactionType] || '👍',
          count: details.count,
          members: details.reacted_members || [],
          isUserReacted: hasUserReacted(type as ReactionType),
        }))
    : [];

  const handleReactionSelect = (reactionType: ReactionType) => {
    onReactionClick(reactionType);
    setPickerVisible(false);
  };

  const handleReactionBadgeClick = (reactionType: ReactionType) => {
    onReactionClick(reactionType);
  };

  // Reaction picker content
  const pickerContent = (
    <div className={`reaction-picker-content theme-${themeMode}`}>
      {availableReactions.length > 0 ? (
        availableReactions.map(config => (
          <button
            key={config.type}
            className="reaction-picker-button"
            onClick={() => handleReactionSelect(config.type)}
            title={config.label}
            aria-label={config.label}
          >
            <span className="reaction-picker-emoji">{config.emoji}</span>
          </button>
        ))
      ) : (
        <div className="no-reactions-message">
          <span>Click your reaction to remove it</span>
        </div>
      )}
    </div>
  );

  return (
    <div className={`comment-reactions-bar theme-${themeMode}`}>
      {/* Existing reactions */}
      {existingReactions.map(reaction => (
        <Tooltip
          key={reaction.type}
          title={
            reaction.members.length > 0 ? (
              <div>
                {reaction.members.map((member, index) => (
                  <div key={index}>{member}</div>
                ))}
              </div>
            ) : null
          }
        >
          <button
            className={`reaction-badge ${reaction.isUserReacted ? 'user-reacted' : ''} theme-${themeMode}`}
            onClick={() => handleReactionBadgeClick(reaction.type)}
            aria-label={`${reaction.isUserReacted ? 'Remove' : 'Add'} ${reaction.type} reaction`}
            title={reaction.isUserReacted ? `Click to remove your ${reaction.type}` : `React with ${reaction.type}`}
          >
            <span className="reaction-badge-emoji">{reaction.emoji}</span>
            <span className="reaction-badge-count">{reaction.count}</span>
          </button>
        </Tooltip>
      ))}

      {/* Add reaction button with picker - only show if user hasn't reacted yet */}
      {!hasUserReactedToAny() && (
        <Popover
          content={pickerContent}
          trigger="click"
          open={pickerVisible}
          onOpenChange={setPickerVisible}
          placement="topLeft"
          overlayClassName={`reaction-picker-popover theme-${themeMode}`}
          arrow={false}
        >
          <button
            className={`add-reaction-button theme-${themeMode}`}
            aria-label="Add reaction"
            title="Add reaction"
          >
            <SmileOutlined />
          </button>
        </Popover>
      )}
    </div>
  );
};

export default CommentReactionsBar;
