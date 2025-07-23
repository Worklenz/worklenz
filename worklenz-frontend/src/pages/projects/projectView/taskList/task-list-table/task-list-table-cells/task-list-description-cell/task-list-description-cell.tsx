import { Typography } from '@/shared/antd-imports';
import DOMPurify from 'dompurify';

const TaskListDescriptionCell = ({ description }: { description: string }) => {
  const sanitizedDescription = DOMPurify.sanitize(description);

  return (
    <Typography.Paragraph
      ellipsis={{
        expandable: false,
        rows: 1,
        tooltip: description,
      }}
      style={{ width: 260, marginBlockEnd: 0 }}
    >
      <span dangerouslySetInnerHTML={{ __html: sanitizedDescription }} />
    </Typography.Paragraph>
  );
};

export default TaskListDescriptionCell;
