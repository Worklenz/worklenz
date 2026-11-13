import React, { useEffect, useState } from 'react';
import { Button, Card, Drawer, Flex, Table, Typography, DownloadOutlined, PaperClipOutlined, theme } from '@/shared/antd-imports';
import type { TableColumnsType } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMessage } from '@/hooks/useMessage';
import { useGetTasksQuery, useGetThreadsQuery, usePostCommentMutation } from '@/store/api-v2';
import { useClientAccess } from '@/hooks/useClientAccess';
import { useFormatters } from '@/hooks/useFormatters';
import { useFileAccess } from '@/hooks/useFileActions';
import { CommentComposer, EmptyState, MessageList, QueryState, RichTextView, StatusTag, UnavailableBanner } from '@/components/v2';
import type { ClientProjectV2, ClientTaskV2 } from '@/types/v2';
import { decodeHtmlEntities } from '@/utils/html-entities';

/** Read-only table of the tasks the team shared, with a detail drawer. `?task=` opens one. */
export const TasksTab: React.FC<{ project: ClientProjectV2 }> = ({ project }) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const wanted = searchParams.get('task');
  const query = useGetTasksQuery(project.id);
  const { date } = useFormatters();
  const [openId, setOpenId] = useState<string | null>(wanted);

  useEffect(() => {
    if (wanted) setOpenId(wanted);
  }, [wanted]);

  const tasks = query.data ?? [];
  const open = tasks.find(task => task.id === openId);
  const missing = Boolean(wanted) && query.isSuccess && !tasks.some(task => task.id === wanted);

  const close = () => {
    setOpenId(null);
    if (searchParams.has('task')) {
      const next = new URLSearchParams(searchParams);
      next.delete('task');
      setSearchParams(next, { replace: true });
    }
  };

  const columns: TableColumnsType<ClientTaskV2> = [
    {
      title: t('tasks.task', { defaultValue: 'Task' }),
      dataIndex: 'title',
      render: (title: string, task) => (
        <Button type="link" style={{ padding: 0, fontWeight: 600, height: 'auto', whiteSpace: 'normal', textAlign: 'start' }} onClick={() => setOpenId(task.id)}>
          {decodeHtmlEntities(title)}
        </Button>
      ),
    },
    {
      title: t('tasks.status', { defaultValue: 'Status' }),
      dataIndex: 'status',
      render: (status: string) => <StatusTag kind="task" status={status} />,
    },
    {
      title: t('tasks.due', { defaultValue: 'Due' }),
      dataIndex: 'due_date',
      responsive: ['sm'],
      render: (value: string | null) => (value ? date(value) : '—'),
    },
    {
      title: t('tasks.about', { defaultValue: 'About' }),
      dataIndex: 'description',
      responsive: ['lg'],
      render: (value: string) => <Typography.Text type="secondary">{value}</Typography.Text>,
    },
  ];

  return (
    <QueryState {...query} refetch={query.refetch}>
      {missing && <UnavailableBanner what="task" />}
      {tasks.length === 0 ? (
        <EmptyState
          title={t('tasks.none', { defaultValue: 'No tasks are shared with you yet.' })}
          description={t('tasks.noneHelp', { defaultValue: 'Your team shares the ones that matter to you.' })}
        />
      ) : (
        <>
          <Card styles={{ body: { padding: 0 } }}>
            <Table<ClientTaskV2> rowKey="id" columns={columns} dataSource={tasks} pagination={false} scroll={{ x: 'max-content' }} />
          </Card>
          <Typography.Paragraph type="secondary" style={{ marginTop: 10, fontSize: 12 }}>
            {t('tasks.readOnly', { defaultValue: 'You see the tasks your team chose to share. You cannot edit them.' })}
          </Typography.Paragraph>
        </>
      )}
      <TaskDrawer task={open} projectId={project.id} onClose={close} />
    </QueryState>
  );
};

const TaskDrawer = ({ task, projectId, onClose }: { task: ClientTaskV2 | undefined; projectId: string; onClose: () => void }) => {
  const { t } = useTranslation();
  const message = useMessage();
  const { token } = theme.useToken();
  const { can } = useClientAccess();
  const { date } = useFormatters();
  const { openFile } = useFileAccess();
  const { data: threads } = useGetThreadsQuery({ projectId });
  const [postComment] = usePostCommentMutation();

  const thread = task ? threads?.find(x => x.context.type === 'task' && x.context.ref_id === task.id) : undefined;

  const send = async (text: string) => {
    if (!task) return;
    try {
      await postComment({ project_id: projectId, context: { type: 'task', ref_id: task.id }, text }).unwrap();
      void message.success(t('discussions.posted', { defaultValue: 'Comment posted. Your team is notified.' }));
    } catch (error) {
      void message.error(t('discussions.postFailed', { defaultValue: 'We could not post your comment. Please try again.' }));
      throw error;
    }
  };

  return (
    <Drawer
      open={Boolean(task)}
      onClose={onClose}
      width={460}
      title={decodeHtmlEntities(task?.title)}
      destroyOnClose
    >
      {task && (
        <>
          <Flex gap={8} align="center" style={{ marginBottom: 12 }}>
            <StatusTag kind="task" status={task.status} />
            {task.due_date && (
              <Typography.Text type="secondary">
                {t('tasks.dueOn', { date: date(task.due_date), defaultValue: 'Due {{date}}' })}
              </Typography.Text>
            )}
          </Flex>
          <div style={{ lineHeight: 1.6, marginBottom: 12 }}>
            <RichTextView value={task.description} />
          </div>

          {task.attachments.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Typography.Text type="secondary" strong style={{ fontSize: token.fontSizeSM }}>
                {t('tasks.attachmentsLabel', { defaultValue: 'ATTACHMENTS' })}
              </Typography.Text>
              {task.attachments.map(file => (
                <Flex key={file.id} align="center" gap={8} style={{ padding: '6px 0' }}>
                  <PaperClipOutlined aria-hidden />
                  <span style={{ flex: 1 }}>
                    {file.name} <Typography.Text type="secondary">v{file.version}</Typography.Text>
                  </span>
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    aria-label={`${t('files.download', { defaultValue: 'Download' })} ${file.name}`}
                    onClick={() => void openFile(file, 'download', file.version)}
                  />
                </Flex>
              ))}
            </div>
          )}

          <Typography.Text type="secondary" strong style={{ fontSize: token.fontSizeSM }}>
            {t('tasks.comments', { defaultValue: 'COMMENTS' })}
          </Typography.Text>
          <div style={{ marginTop: 8 }}>
            <MessageList messages={thread?.messages ?? []} emptyText={t('tasks.noCommentsYet', { defaultValue: 'No comments yet.' })} />
          </div>
          <CommentComposer
            canComment={can.comment}
            placeholder={t('tasks.addComment', { defaultValue: 'Add a comment…' })}
            lockedText={t('locked.comment', { defaultValue: "Client Viewers can't comment." })}
            onSend={send}
          />
        </>
      )}
    </Drawer>
  );
};
