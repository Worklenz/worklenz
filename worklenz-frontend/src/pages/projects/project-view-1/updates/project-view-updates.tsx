import { Button, ConfigProvider, Flex, Form, Mentions, Skeleton, Space, Tooltip, Typography } from 'antd';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import { useParams } from 'react-router-dom';

import CustomAvatar from '@components/CustomAvatar';
import { colors } from '@/styles/colors';
import {
  IMentionMemberSelectOption,
  IMentionMemberViewModel,
} from '@/types/project/projectComments.types';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { projectCommentsApiService } from '@/api/projects/comments/project-comments.api.service';
import { IProjectUpdateCommentViewModel } from '@/types/project/project.types';
import { calculateTimeDifference } from '@/utils/calculate-time-difference';
import { getUserSession } from '@/utils/session-helper';
import './project-view-updates.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { DeleteOutlined } from '@ant-design/icons';

const MAX_COMMENT_LENGTH = 2000;

const ProjectViewUpdates = () => {
  const { projectId } = useParams();
  const [characterLength, setCharacterLength] = useState<number>(0);
  const [isCommentBoxExpand, setIsCommentBoxExpand] = useState<boolean>(false);
  const [members, setMembers] = useState<IMentionMemberViewModel[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<{ id: string; name: string }[]>([]);
  const [comments, setComments] = useState<IProjectUpdateCommentViewModel[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingComments, setIsLoadingComments] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [commentValue, setCommentValue] = useState<string>('');
  const theme = useAppSelector(state => state.themeReducer.mode);
  const { refreshTimestamp } = useAppSelector(state => state.projectReducer);

  const { t } = useTranslation('project-view-updates');
  const [form] = Form.useForm();

  const getMembers = useCallback(async () => {
    if (!projectId) return;
    try {
      setIsLoading(true);
      const res = await projectCommentsApiService.getMentionMembers(projectId, 1, 15, null, null, null);
      if (res.done) {
        setMembers(res.body as IMentionMemberViewModel[]);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const getComments = useCallback(async () => {
    if (!projectId) return;
    try {
      setIsLoadingComments(true);
      const res = await projectCommentsApiService.getByProjectId(projectId);
      if (res.done) {
        setComments(res.body);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setIsLoadingComments(false);
    }
  }, [projectId]);

  const handleAddComment = useCallback(async () => {
    if (!projectId || characterLength === 0) return;

    try {
      setIsSubmitting(true);
      
      if (!commentValue) {
        console.error('Comment content is empty');
        return;
      }

      const body = {
        project_id: projectId,
        team_id: getUserSession()?.team_id,
        content: commentValue.trim(),
        mentions: selectedMembers
      };

      const res = await projectCommentsApiService.createProjectComment(body);
      if (res.done) {
        await getComments();
        handleCancel();
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setIsSubmitting(false);
      setCommentValue('');
    }
  }, [projectId, characterLength, commentValue, selectedMembers, getComments]);

  useEffect(() => {
    void getMembers();
    void getComments();
  }, [getMembers, getComments, refreshTimestamp]);

  const handleCancel = useCallback(() => {
    form.resetFields(['comment']);
    setCharacterLength(0);
    setIsCommentBoxExpand(false);
    setSelectedMembers([]);
  }, [form]);

  const mentionsOptions = useMemo(() => 
    members?.map(member => ({
      value: member.id,
      label: member.name,
    })) ?? [], [members]
  );

  const memberSelectHandler = useCallback((member: IMentionMemberSelectOption) => {
    if (!member?.value || !member?.label) return;
    
    setSelectedMembers(prev =>
      prev.some(mention => mention.id === member.value)
        ? prev
        : [...prev, { id: member.value, name: member.label }]
    );

    setCommentValue(prev => {
      const parts = prev.split('@');
      const lastPart = parts[parts.length - 1];
      const mentionText = member.label;
      return prev.slice(0, prev.length - lastPart.length) + mentionText;
    });
  }, []);

  const handleCommentChange = useCallback((value: string) => {
    setCommentValue(value);
    setCharacterLength(value.trim().length);
  }, []);

  const handleDeleteComment = useCallback(
    async (commentId: string | undefined) => {
      if (!commentId) return;
      try {
        const res = await projectCommentsApiService.deleteComment(commentId);
        if (res.done) {
          void getComments();
        }
      } catch (error) {
        console.error('Failed to delete comment:', error);
      }
    },
    [getComments]
  );

  const configProviderTheme = useMemo(() => ({
    components: {
      Button: {
        defaultColor: colors.lightGray,
        defaultHoverColor: colors.darkGray,
      },
    },
  }), []);

  const renderComment = useCallback((comment: IProjectUpdateCommentViewModel) => {
    const sanitizedContent = DOMPurify.sanitize(comment.content || '');
    const timeDifference = calculateTimeDifference(comment.created_at || '');
    const themeClass = theme === 'dark' ? 'dark' : 'light';
    
    return (
      <Flex key={comment.id} gap={8}>
        <CustomAvatar avatarName={comment.created_by || ''} />
        <Flex vertical flex={1}>
          <Space>
            <Typography.Text strong style={{ fontSize: 13, color: colors.lightGray }}>
              {comment.created_by || ''}
            </Typography.Text>
            <Tooltip title={comment.created_at}>
              <Typography.Text style={{ fontSize: 13, color: colors.deepLightGray }}>
                {timeDifference}
              </Typography.Text>
            </Tooltip>
          </Space>
          <Typography.Paragraph 
            style={{ margin: '8px 0' }}
            ellipsis={{ rows: 3, expandable: true }}
          >
            <div className={`mentions-${themeClass}`} dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
          </Typography.Paragraph>
          <ConfigProvider
            wave={{ disabled: true }}
            theme={configProviderTheme}
          >
            <Button
              icon={<DeleteOutlined />}
              shape="circle"
              type="text"
              size='small'
              onClick={() => handleDeleteComment(comment.id)}
            />
          </ConfigProvider>
        </Flex>
      </Flex>
    );
  }, [theme, configProviderTheme, handleDeleteComment]);

  const commentsList = useMemo(() => 
    comments.map(renderComment), [comments, renderComment]
  );

  return (
    <Flex gap={24} vertical>
      <Flex vertical gap={16}>
        {isLoadingComments ? (
          <Skeleton active />
        ) : (
          commentsList
        )}
      </Flex>

      <Form onFinish={handleAddComment}>
        <Form.Item>
          <Mentions
            value={commentValue}
            placeholder={t('inputPlaceholder')}
            loading={isLoading}
            options={mentionsOptions}
            autoSize
            maxLength={MAX_COMMENT_LENGTH}
            onSelect={(option, prefix) => memberSelectHandler(option as IMentionMemberSelectOption)}
            onClick={() => setIsCommentBoxExpand(true)}
            onChange={handleCommentChange}
            prefix="@"
            split=""
            filterOption={(input, option) => {
              if (!input) return true;
              const optionLabel = (option as any)?.label || '';
              return optionLabel.toLowerCase().includes(input.toLowerCase());
            }}
            style={{
              minHeight: isCommentBoxExpand ? 180 : 60,
              paddingBlockEnd: 24,
            }}
          />
          <span
            style={{
              position: 'absolute',
              bottom: 4,
              right: 12,
              color: colors.lightGray,
            }}
          >{`${characterLength}/${MAX_COMMENT_LENGTH}`}</span>
        </Form.Item>

        {isCommentBoxExpand && (
          <Form.Item>
            <Flex gap={8} justify="flex-end">
              <Button onClick={handleCancel} disabled={isSubmitting}>
                {t('cancelButton')}
              </Button>
              <Button
                type="primary"
                loading={isSubmitting}
                disabled={characterLength === 0}
                htmlType="submit"
              >
                {t('addButton')}
              </Button>
            </Flex>
          </Form.Item>
        )}
      </Form>
    </Flex>
  );
};

export default ProjectViewUpdates;
