import { Empty, Modal, Spin, Tag, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { IWhatsNewRelease } from '@/types/whats-new/whats-new.types';
import { formatReleaseDate } from './formatReleaseDate';

const { Text } = Typography;

// Matches the spec's supported-elements list (FR-3.4): headings, lists, bold,
// italic, inline code, links. `skipHtml` drops any raw HTML nodes entirely
// rather than rendering or escaping them, so embedded <script>/<img> tags
// never reach the DOM.
const ALLOWED_ELEMENTS = ['h2', 'h3', 'ul', 'ol', 'li', 'p', 'strong', 'em', 'code', 'a', 'hr', 'br'];

const isSafeChangelogUrl = (url: string | null): url is string =>
  !!url && /^https?:\/\//i.test(url);

// This app's global styles reset default heading/list/hr appearance (no
// bullets, no heading emphasis, no visible <hr>), so react-markdown's raw
// output renders as flat, unstyled paragraphs. Own the styling explicitly
// here instead of relying on browser defaults nothing else in the app
// leaves intact. Only structural properties (size/weight/spacing/markers)
// are set — text color is left to inherit from the Modal's own theme-aware
// color so this still looks correct in both light and dark mode.
const MARKDOWN_COMPONENTS = {
  h2: ({ node, ...props }: any) => (
    <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 20, marginBottom: 8 }} {...props} />
  ),
  h3: ({ node, ...props }: any) => (
    <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 16, marginBottom: 6 }} {...props} />
  ),
  p: ({ node, ...props }: any) => <p style={{ margin: '0 0 12px', lineHeight: 1.6 }} {...props} />,
  ul: ({ node, ...props }: any) => (
    <ul style={{ margin: '0 0 12px', paddingLeft: 20, listStyleType: 'disc' }} {...props} />
  ),
  ol: ({ node, ...props }: any) => (
    <ol style={{ margin: '0 0 12px', paddingLeft: 20, listStyleType: 'decimal' }} {...props} />
  ),
  li: ({ node, ...props }: any) => <li style={{ marginBottom: 4, lineHeight: 1.6 }} {...props} />,
  hr: ({ node, ...props }: any) => (
    <hr style={{ border: 'none', borderTop: '1px solid rgba(128, 128, 128, 0.25)', margin: '16px 0' }} {...props} />
  ),
  code: ({ node, ...props }: any) => (
    <code
      style={{ background: 'rgba(128, 128, 128, 0.15)', padding: '2px 5px', borderRadius: 3, fontSize: '0.9em' }}
      {...props}
    />
  ),
  a: ({ node, ...props }: any) => <a target="_blank" rel="noopener noreferrer" {...props} />,
};

type WhatsNewReleaseModalProps = {
  open: boolean;
  release: IWhatsNewRelease | null;
  loading?: boolean;
  notFound?: boolean;
  onClose: () => void;
};

const WhatsNewReleaseModal = ({ open, release, loading, notFound, onClose }: WhatsNewReleaseModalProps) => {
  const { t } = useTranslation('navbar');

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={600}
      styles={{ body: { maxHeight: '72vh', overflowY: 'auto' } }}
      destroyOnClose
      footer={
        release && isSafeChangelogUrl(release.changelog_url) ? (
          <a href={release.changelog_url} target="_blank" rel="noopener noreferrer">
            {t('whatsNew.readFullChangelog', { defaultValue: 'Read full changelog →' })}
          </a>
        ) : null
      }
      title={
        release ? (
          <div>
            <Tag
              style={{
                backgroundColor: '#52c41a',
                color: '#fff',
                border: 'none',
                marginInlineEnd: 8,
              }}
            >
              {t('whatsNew.newBadge', { defaultValue: 'New' })}
            </Tag>
            {t('whatsNew.modalHeading', {
              defaultValue: "What's New — {{title}}",
              title: release.title,
            })}
            <div>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                {formatReleaseDate(release.published_at)}
              </Text>
            </div>
          </div>
        ) : null
      }
    >
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
          <Spin />
        </div>
      )}
      {!loading && notFound && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('whatsNew.releaseUnavailable', { defaultValue: 'This update is no longer available.' })}
        />
      )}
      {!loading && !notFound && release && (
        <ReactMarkdown skipHtml allowedElements={ALLOWED_ELEMENTS} components={MARKDOWN_COMPONENTS}>
          {release.body_markdown}
        </ReactMarkdown>
      )}
    </Modal>
  );
};

export default WhatsNewReleaseModal;
