import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeftOutlined,
  CheckSquareOutlined,
  ContainerOutlined,
  EyeInvisibleOutlined,
  FileTextOutlined,
  FolderOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { Alert, Button, Flex, Result, Typography, theme } from '@/shared/antd-imports';
import { useGetThreadOptionsQuery, useGetThreadQuery } from '@/api/client-portal/portal-workflow-api';
import { StatusTag } from '@/components/client-portal/v2';
import type { ThreadContextType } from '@/types/client-portal/v2';
import { ThreadComposer } from './ThreadComposer';
import { ThreadMessages } from './ThreadMessages';
import { PortalLoader } from '@/components/client-portal/v2';
import { decodeHtmlEntities } from '@/utils/html-entities';

interface ThreadViewProps {
  threadId: string;
  /** Set on narrow screens, where the thread replaces the list instead of sitting beside it. */
  onBack?: () => void;
}

const CONTEXT_ICONS: Record<ThreadContextType, ReactNode> = {
  project: <FolderOutlined />,
  task: <CheckSquareOutlined />,
  file: <FileTextOutlined />,
  approval: <ContainerOutlined />,
  change_request: <SwapOutlined />,
};

/** One conversation: what it is about, every message, and the composer. Opening it marks it read. */
export const ThreadView = ({ threadId, onBack }: ThreadViewProps) => {
  const { t } = useTranslation('client-portal-v2-discussions');
  const { token } = theme.useToken();

  const threadQuery = useGetThreadQuery(threadId);
  const thread = threadQuery.data?.body;
  const optionsQuery = useGetThreadOptionsQuery(thread?.project_id ?? '', { skip: !thread });

  if (threadQuery.isLoading) {
    return (
      <div style={{ padding: 16 }} aria-busy="true">
        <PortalLoader />
      </div>
    );
  }

  if (threadQuery.isError || !thread) {
    const isNotFound = (threadQuery.error as { status?: number } | undefined)?.status === 404;
    return (
      <Result
        status={isNotFound ? '404' : 'error'}
        title={
          isNotFound
            ? t('thread.notFound', { defaultValue: 'Discussion not found' })
            : t('thread.loadFailed', { defaultValue: 'Could not load this discussion' })
        }
        extra={
          !isNotFound && (
            <Button type="primary" onClick={() => threadQuery.refetch()}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          )
        }
      />
    );
  }

  return (
    <Flex vertical style={{ height: '100%', minHeight: 0 }}>
      <Flex
        align="center"
        justify="space-between"
        gap={10}
        wrap="wrap"
        style={{ padding: '12px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}
      >
        <Flex align="center" gap={10} style={{ minWidth: 0 }}>
          {onBack && (
            <Button
              size="small"
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={onBack}
              aria-label={t('thread.back', { defaultValue: 'Back to discussions' })}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span aria-hidden>{CONTEXT_ICONS[thread.context.type]}</span>
              <span style={{ overflowWrap: 'anywhere' }}>{thread.context.label}</span>
            </div>
            <Flex align="center" gap={4} wrap="wrap" style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 2 }}>
              <Typography.Text
                type="secondary"
                style={{ fontSize: 11 }}
                copyable={{
                  text: thread.ref_no,
                  tooltips: [
                    t('thread.copyRef', { defaultValue: 'Copy discussion ID' }),
                    t('thread.copiedRef', { defaultValue: 'Copied' }),
                  ],
                }}
              >
                {thread.ref_no}
              </Typography.Text>
              <span aria-hidden>·</span>
              <span>
                {thread.organization_name} · {decodeHtmlEntities(thread.project_name)}
              </span>
            </Flex>
          </div>
        </Flex>
        {thread.hidden_from_client && (
          <StatusTag tone="red" icon={<EyeInvisibleOutlined />}>
            {t('thread.hiddenTag', { defaultValue: 'Hidden from the client: the linked item is Internal Only' })}
          </StatusTag>
        )}
      </Flex>

      <ThreadMessages messages={thread.messages} />

      {optionsQuery.isError && (
        <Alert
          type="warning"
          showIcon
          style={{ margin: '0 16px 8px' }}
          message={t('thread.audienceUnavailable', {
            defaultValue: 'The list of people could not be loaded, so mentions are unavailable.',
          })}
        />
      )}
      <ThreadComposer
        threadId={thread.id}
        projectId={thread.project_id}
        audience={optionsQuery.data?.body?.mentions ?? []}
        members={optionsQuery.data?.body?.members ?? []}
      />
    </Flex>
  );
};
