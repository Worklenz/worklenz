import { Button, Flex, Form, Typography, message, Tooltip, Space } from '@/shared/antd-imports';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PaperClipOutlined, DeleteOutlined, PlusOutlined } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { colors } from '@/styles/colors';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { IMentionMemberSelectOption } from '@/types/project/projectComments.types';
import { ITaskCommentsCreateRequest } from '@/types/tasks/task-comments.types';
import { ITaskAttachment } from '@/types/tasks/task-attachment-view-model';
import logger from '@/utils/errorLogger';
import taskCommentsApiService from '@/api/tasks/task-comments.api.service';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { ITeamMember } from '@/types/teamMembers/teamMember.types';
import { fromNow } from '@/utils/dateUtils';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess } from '@/ee/utils/subscription-utils';
import CustomMentionsInput, { MentionOption } from './comments/custom-mentions-input';
import { useAppSumoTracking } from '@/ee/hooks/useAppSumoTracking';
import { AppSumoUpsellEvents } from '@/types/mixpanel-events.types';
import './info-tab-footer.css';

// Utility function to convert file to base64
const getBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// Utility function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const COMMENT_ATTACHMENT_SIZE_LIMIT_BYTES = 25 * 1024 * 1024;

const InfoTabFooter = () => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const MAXIMUM_FILE_COUNT = 5;

  const [characterLength, setCharacterLength] = useState<number>(0);
  const [isCommentBoxExpand, setIsCommentBoxExpand] = useState<boolean>(false);
  const [attachmentComment, setAttachmentComment] = useState<boolean>(false);
  const [selectedFiles, setSelectedFiles] = useState<ITaskAttachment[]>([]);

  const { taskFormViewModel, selectedTaskId } = useAppSelector(state => state.taskDrawerReducer);
  const { projectId } = useAppSelector(state => state.projectReducer);
  const dispatch = useAppDispatch();
  const currentSession = useAuthService().getCurrentSession();
  const hasBusinessAccess = hasBusinessFeatureAccess(currentSession);
  const { trackAppSumoEvent } = useAppSumoTracking();
  const isAppSumoUser = String(currentSession?.subscription_type || '').toLowerCase().includes('appsumo');

  const [members, setMembers] = useState<ITeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState<boolean>(false);

  const [selectedMembers, setSelectedMembers] = useState<
    { team_member_id: string; name: string }[]
  >([]);
  const [commentValue, setCommentValue] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);

  const [form] = Form.useForm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const projectMembersList = useAppSelector(state => state.projectMemberReducer.membersList);

  const createdFromNow = useMemo(() => {
    const createdAt = taskFormViewModel?.task?.created_at;
    if (!createdAt) return 'N/A';
    try {
      return fromNow(createdAt);
    } catch (error) {
      console.error('Error formatting created_at:', error, createdAt);
      return 'N/A';
    }
  }, [taskFormViewModel?.task?.created_at]);

  const updatedFromNow = useMemo(() => {
    const updatedAt = taskFormViewModel?.task?.updated_at;
    if (!updatedAt) return 'N/A';
    try {
      return fromNow(updatedAt);
    } catch (error) {
      console.error('Error formatting updated_at:', error, updatedAt);
      return 'N/A';
    }
  }, [taskFormViewModel?.task?.updated_at]);

  const handleCancel = () => {
    form.resetFields(['comment']);
    setCharacterLength(0);
    setIsCommentBoxExpand(false);
    setSelectedFiles([]);
    setAttachmentComment(false);
    setCommentValue('');
    setSelectedMembers([]);
  };

  const isCommentValid = useCallback(() => {
    return characterLength > 0 || selectedFiles.length > 0;
  }, [characterLength, selectedFiles.length]);

  const getMembers = useCallback(async () => {
    if (!projectId) return;
    try {
      setMembersLoading(true);
      const res = await teamMembersApiService.get(1, 10, null, null, null, true);

      if (res.done) {
        setMembers(res.body.data?.filter(t => !t.pending_invitation) as ITeamMember[]);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setMembersLoading(false);
    }
  }, [projectId]);

  const mentionsOptions =
    members?.map(member => ({
      value: member.name,
      label: member.name,
      key: member.id,
    })) ?? [];

  const memberSelectHandler = useCallback(
    (member: IMentionMemberSelectOption) => {
      if (!member?.value || !member?.label) return;

      const selectedMember = members.find(m => m.name === member.value);
      if (!selectedMember) return;

      setSelectedMembers(prev =>
        prev.some(mention => mention.team_member_id === selectedMember.id)
          ? prev
          : [
              ...prev,
              {
                team_member_id: selectedMember.id!,
                name: selectedMember.name!,
              },
            ]
      );
    },
    [members]
  );

  const handleCommentChange = useCallback((value: string) => {
    setCommentValue(value);
    setCharacterLength(value.trim().length);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedTaskId || !projectId) return;

    if (!isCommentValid()) {
      message.error(
        t('taskInfoTab.comments.addCommentError', {
          defaultValue: 'Please add a comment or attachment',
        })
      );
      return;
    }

    try {
      const hasOversizedAttachment = selectedFiles.some(
        file => Number(file.size || 0) > COMMENT_ATTACHMENT_SIZE_LIMIT_BYTES
      );

      if (!hasBusinessAccess && hasOversizedAttachment) {
        message.warning(
          t('taskInfoTab.comments.fileTooLargeToSend', {
            defaultValue:
              'Files over 25MB in comments require the Business plan. Remove this file or upgrade to continue.',
          })
        );
        if (isAppSumoUser) {
          trackAppSumoEvent(AppSumoUpsellEvents.COMMENT_ATTACHMENT_REPLACED, { feature: 'comment_attachments' });
          trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_PROMPT_SHOWN, { feature: 'comment_attachments' });
        }
        dispatch(toggleUpgradeModal());
        return;
      }

      setUploading(true);
      const body: ITaskCommentsCreateRequest = {
        task_id: selectedTaskId,
        content: commentValue || '',
        mentions: Array.from(new Set(selectedMembers.map(member => JSON.stringify(member)))).map(
          str => JSON.parse(str)
        ),
        attachments: selectedFiles,
      };

      const res = await taskCommentsApiService.create(body);
      if (res.done) {
        form.resetFields(['comment']);
        setCharacterLength(0);
        setSelectedFiles([]);
        setAttachmentComment(false);
        setIsCommentBoxExpand(false);
        setCommentValue('');
        setSelectedMembers([]);

        document.dispatchEvent(
          new CustomEvent('task-comment-create', {
            detail: { taskId: selectedTaskId },
          })
        );
      }
    } catch (error) {
      logger.error('Failed to create comment:', error);
    } finally {
      setUploading(false);
    }
  }, [
    commentValue,
    selectedMembers,
    selectedFiles,
    selectedTaskId,
    projectId,
    form,
    isCommentValid,
    dispatch,
    t,
    hasBusinessAccess,
  ]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files.length || !selectedTaskId || !projectId) return;

    const files = Array.from(event.target.files);

    if (selectedFiles.length + files.length > MAXIMUM_FILE_COUNT) {
      message.error(
        t('taskInfoTab.comments.maxFilesError', {
          count: MAXIMUM_FILE_COUNT,
          defaultValue: 'You can only upload a maximum of {{count}} files',
        })
      );
      return;
    }

    try {
      setUploading(true);
      setAttachmentComment(true);

      const newFiles: ITaskAttachment[] = [];

      for (const file of files) {
        const base64Data = await getBase64(file);
        const attachment: ITaskAttachment = {
          file: base64Data,
          file_name: file.name,
          project_id: projectId,
          task_id: selectedTaskId,
          size: file.size,
        };
        newFiles.push(attachment);
      }

      setSelectedFiles(prev => [...prev, ...newFiles]);

      if (!isCommentBoxExpand) {
        setIsCommentBoxExpand(true);
      }
    } catch (error) {
      console.error('Failed to process files:', error);
      message.error(
        t('taskInfoTab.comments.processFilesError', {
          defaultValue: 'Failed to process files',
        })
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);
      if (newFiles.length === 0) setAttachmentComment(false);
      return newFiles;
    });
  };

  useEffect(() => {
    void getMembers();
  }, [getMembers]);

  return (
    <Flex
      vertical
      style={{
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 80,
      }}
    >
      <div
        style={{
          marginBlockEnd: 0,
          height: 1,
          position: 'absolute',
          top: 0,
          width: '100%',
          backgroundColor: themeWiseColor('#ebebeb', '#3a3a3a', themeMode),
        }}
      />

      {!isCommentBoxExpand ? (
        <Flex
          vertical
          style={{
            width: '100%',
            padding: '12px 0',
            transition: 'all 0.3s ease-in-out',
          }}
        >
          <CustomMentionsInput
            placeholder={t('taskInfoTab.comments.addCommentPlaceholder', {
              defaultValue: 'Add a comment...',
            })}
            options={mentionsOptions}
            value={commentValue}
            onClick={() => setIsCommentBoxExpand(true)}
            onChange={(e: string) => {
              setCommentValue(e);
              setCharacterLength(e.length);
            }}
            prefix="@"
            filterOption={(input: string, option: any) => {
              if (!input) return true;
              const optionLabel = option?.label || '';
              return optionLabel.toLowerCase().includes(input.toLowerCase());
            }}
            style={{
              minHeight: 60,
              resize: 'none',
              borderRadius: 4,
              transition: 'all 0.3s ease-in-out',
            }}
            themeMode={themeMode}
          />
        </Flex>
      ) : (
        <Form
          form={form}
          style={{
            width: '100%',
            transition: 'all 0.3s ease-in-out',
            animation: 'expandAnimation 0.3s ease-in-out',
          }}
        >
          {selectedFiles.length > 0 && (
            <Flex vertical gap={8} style={{ marginTop: 12 }}>
              <Typography.Title level={5} style={{ margin: 0 }}>
                {t('taskInfoTab.comments.selectedFiles', {
                  count: MAXIMUM_FILE_COUNT,
                  defaultValue: 'Selected Files (Maximum of {{count}})',
                })}
              </Typography.Title>
              <Flex
                vertical
                style={{
                  border: `1px solid ${themeWiseColor('#d9d9d9', '#434343', themeMode)}`,
                  borderRadius: 4,
                  padding: '8px 16px',
                  backgroundColor: themeWiseColor('#fff', '#141414', themeMode),
                }}
              >
                {selectedFiles.map((file, index) => (
                  <Flex
                    key={index}
                    justify="space-between"
                    align="center"
                    style={{
                      padding: '8px 0',
                      borderBottom:
                        index < selectedFiles.length - 1
                          ? `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`
                          : 'none',
                    }}
                  >
                    <Typography.Text
                      style={{
                        color: themeWiseColor('#000000d9', '#ffffffd9', themeMode),
                      }}
                    >
                      {file.file_name} ({formatFileSize(file.size)})
                    </Typography.Text>
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => removeFile(index)}
                      style={{ color: '#f5222d' }}
                    />
                  </Flex>
                ))}
                <Flex
                  justify="center"
                  align="center"
                  style={{
                    marginTop: 8,
                    cursor: selectedFiles.length >= MAXIMUM_FILE_COUNT ? 'not-allowed' : 'pointer',
                    opacity: selectedFiles.length >= MAXIMUM_FILE_COUNT ? 0.5 : 1,
                  }}
                  onClick={() => {
                    if (selectedFiles.length < MAXIMUM_FILE_COUNT && !uploading) {
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <Button
                    type="link"
                    icon={<PlusOutlined />}
                    disabled={selectedFiles.length >= MAXIMUM_FILE_COUNT || uploading}
                  >
                    {t('taskInfoTab.comments.addMoreFiles', {
                      defaultValue: 'Add More Files',
                    })}
                  </Button>
                </Flex>
              </Flex>
            </Flex>
          )}

          <Form.Item name={'comment'} style={{ marginBlock: 12 }}>
            <div style={{ position: 'relative' }}>
              <CustomMentionsInput
                placeholder={t('taskInfoTab.comments.addCommentPlaceholder', {
                  defaultValue: 'Add a comment...',
                })}
                options={mentionsOptions}
                autoFocus
                value={commentValue}
                onSelect={(option: any) =>
                  memberSelectHandler(option as IMentionMemberSelectOption)
                }
                onChange={handleCommentChange}
                onSubmit={handleSubmit}
                prefix="@"
                filterOption={(input: string, option: any) => {
                  if (!input) return true;
                  const optionLabel = option?.label || '';
                  return optionLabel.toLowerCase().includes(input.toLowerCase());
                }}
                style={{
                  minHeight: 100,
                  maxHeight: 200,
                  paddingBlockEnd: 24,
                  borderRadius: 4,
                }}
                themeMode={themeMode}
              />
              <span
                style={{
                  position: 'absolute',
                  bottom: 4,
                  right: 12,
                  color: colors.lightGray,
                  fontSize: 12,
                  zIndex: 10,
                  pointerEvents: 'none',
                }}
              >{`${characterLength}/5000`}</span>
            </div>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 11, marginTop: 4, display: 'block' }}
            >
              {t('taskInfoTab.comments.enterHint', {
                defaultValue: 'Enter to send  ·  Shift+Enter for new line',
              })}
            </Typography.Text>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Flex gap={8} justify="space-between">
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
                disabled={uploading || selectedFiles.length >= MAXIMUM_FILE_COUNT}
                multiple
              />
              <Tooltip
                title={
                  selectedFiles.length >= MAXIMUM_FILE_COUNT
                    ? t('taskInfoTab.comments.maxFilesError', {
                        count: MAXIMUM_FILE_COUNT,
                        defaultValue: 'You can only upload a maximum of {{count}} files',
                      })
                    : t('taskInfoTab.comments.attachFiles', {
                        defaultValue: 'Attach Files',
                      })
                }
              >
                <Button
                  icon={<PaperClipOutlined />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || selectedFiles.length >= MAXIMUM_FILE_COUNT}
                />
              </Tooltip>

              <Space>
                <Button onClick={handleCancel}>
                  {t('taskInfoTab.comments.cancel', {
                    defaultValue: 'Cancel',
                  })}
                </Button>
                <Button
                  type="primary"
                  disabled={!isCommentValid()}
                  onClick={handleSubmit}
                  loading={uploading}
                >
                  {t('taskInfoTab.comments.commentButton', {
                    defaultValue: 'Comment',
                  })}
                </Button>
              </Space>
            </Flex>
          </Form.Item>
        </Form>
      )}

      <Flex align="center" justify="space-between" style={{ width: '100%', marginTop: 8 }}>
        <Tooltip title={createdFromNow !== 'N/A' ? `Created ${createdFromNow}` : 'N/A'}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('taskInfoTab.comments.createdBy', {
              defaultValue: 'Created {time} by {user}',
              time: createdFromNow,
              user: taskFormViewModel?.task?.reporter || '',
            })}
          </Typography.Text>
        </Tooltip>
        <Tooltip title={updatedFromNow !== 'N/A' ? `Updated ${updatedFromNow}` : 'N/A'}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('taskInfoTab.comments.updatedTimes', {
              defaultValue: 'Updated {{time}}',
              time: updatedFromNow,
            })}
          </Typography.Text>
        </Tooltip>
      </Flex>
    </Flex>
  );
};

export default InfoTabFooter;
