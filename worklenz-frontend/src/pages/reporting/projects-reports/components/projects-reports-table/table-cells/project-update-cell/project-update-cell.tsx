import { Tooltip } from '@/shared/antd-imports';
import { sanitizeHtml, stripHtmlTags } from '@/utils/sanitizeInput';

type ProjectUpdateCellProps = {
  updates: string;
};

const ProjectUpdateCell = ({ updates }: ProjectUpdateCellProps) => {
  // Sanitize content to prevent XSS attacks
  const sanitizedContent = sanitizeHtml(updates || '');

  // Strip HTML tags for the plain text version (for tooltip and display)
  const plainText = stripHtmlTags(sanitizedContent);

  return (
    <Tooltip title={plainText} placement="topLeft">
      <div
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
          cursor: 'pointer',
        }}
        className="group-hover:text-[#1890ff]"
      >
        {plainText}
      </div>
    </Tooltip>
  );
};

export default ProjectUpdateCell;
