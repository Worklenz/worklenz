import { Typography } from '@/shared/antd-imports';

const TaskRowDescription = ({ description }: { description: string }) => {
  return (
    <div
      style={{
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: 'block',
        maxHeight: '24px', // Enforce single line height
        lineHeight: '24px',
      }}
      dangerouslySetInnerHTML={{ __html: description }}
    />
  );
};

export default TaskRowDescription;
