import { Popover } from 'antd';
import { SmileOutlined } from '@ant-design/icons';

const EMOJIS = ['👍', '❤️', '😄', '😮', '😢', '🎉', '🚀', '👀', '🔥', '💯'];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

const EmojiPicker = ({ onSelect }: EmojiPickerProps) => {
  return (
    <Popover
      content={
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 8,
            padding: 4,
          }}
        >
          {EMOJIS.map(emoji => (
            <span
              key={emoji}
              onClick={() => onSelect(emoji)}
              style={{
                fontSize: 20,
                cursor: 'pointer',
                padding: 6,
                borderRadius: 4,
                textAlign: 'center',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = '#f0f0f0';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {emoji}
            </span>
          ))}
        </div>
      }
      trigger="click"
      placement="topLeft"
    >
      <SmileOutlined style={{ fontSize: 14, cursor: 'pointer' }} />
    </Popover>
  );
};

export default EmojiPicker;
