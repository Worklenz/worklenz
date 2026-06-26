import { ReactionType } from '@/types/tasks/task-comments.types';

export interface IReactionConfig {
  type: ReactionType;
  emoji: string;
  label: string;
  color: string;
}

export const REACTION_CONFIGS: IReactionConfig[] = [
  {
    type: 'like',
    emoji: '👍',
    label: 'Like',
    color: '#1890ff',
  },
  {
    type: 'love',
    emoji: '❤️',
    label: 'Love',
    color: '#ff4d4f',
  },
  {
    type: 'celebrate',
    emoji: '🎉',
    label: 'Celebrate',
    color: '#faad14',
  },
  {
    type: 'support',
    emoji: '💪',
    label: 'Support',
    color: '#52c41a',
  },
  {
    type: 'insightful',
    emoji: '💡',
    label: 'Insightful',
    color: '#fadb14',
  },
  {
    type: 'curious',
    emoji: '🤔',
    label: 'Curious',
    color: '#722ed1',
  },
];

export const getReactionConfig = (type: ReactionType): IReactionConfig | undefined => {
  return REACTION_CONFIGS.find(config => config.type === type);
};
