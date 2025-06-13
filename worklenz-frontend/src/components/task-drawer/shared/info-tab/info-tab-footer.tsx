import { Button, Flex, Form, Mentions, Space, Tooltip, Typography, message } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PaperClipOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useAppSelector } from '@/hooks/useAppSelector';
import { colors } from '@/styles/colors';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { formatDateTimeWithLocale } from '@/utils/format-date-time-with-locale';
import { calculateTimeDifference } from '@/utils/calculate-time-difference';
import {
  IMentionMemberSelectOption,
  IMentionMemberViewModel,
} from '@/types/project/projectComments.types';
import { projectCommentsApiService } from '@/api/projects/comments/project-comments.api.service';
import { ITaskCommentsCreateRequest } from '@/types/tasks/task-comments.types';
import { ITaskAttachment } from '@/types/tasks/task-attachment-view-model';
import logger from '@/utils/errorLogger';
import taskCommentsApiService from '@/api/tasks/task-comments.api.service';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { ITeamMember } from '@/types/teamMembers/teamMember.types';

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

const InfoTabFooter = () => {
  const MAXIMUM_FILE_COUNT = 5;

  const [characterLength, setCharacterLength] = useState<number>(0);
  const [isCommentBoxExpand, setIsCommentBoxExpand] = useState<boolean>(false);
  const [attachmentComment, setAttachmentComment] = useState<boolean>(false);
  const [selectedFiles, setSelectedFiles] = useState<ITaskAttachment[]>([]);

  const { taskFormViewModel, selectedTaskId } = useAppSelector(state => state.taskDrawerReducer);
  const { projectId } = useAppSelector(state => state.projectReducer);

  const [members, setMembers] = useState<ITeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState<boolean>(false);

  const [selectedMembers, setSelectedMembers] = useState<{ team_member_id: string; name: string }[]>([]);
  const [commentValue, setCommentValue] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);

  const [form] = Form.useForm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // get theme details from theme slice
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // get member list from project members slice
  const projectMembersList = useAppSelector(state => state.projectMemberReducer.membersList);

  // function to handle cancel
  const handleCancel = () => {
    form.resetFields(['comment']);
    setCharacterLength(0);
    setIsCommentBoxExpand(false);
    setSelectedFiles([]);
    setAttachmentComment(false);
  };

  // Check if comment is valid (either has text or files)
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

  // mentions options
  const mentionsOptions =
    members?.map(member => ({
      value: member.name,
      label: member.name,
      key: member.id,
    })) ?? [];

  const memberSelectHandler = useCallback((member: IMentionMemberSelectOption) => {
    console.log('member', member);
    if (!member?.value || !member?.label) return;
    
    // Find the member ID from the members list using the name
    const selectedMember = members.find(m => m.name === member.value);
    if (!selectedMember) return;
    
    // Add to selected members if not already present
    setSelectedMembers(prev =>
      prev.some(mention => mention.team_member_id === selectedMember.id)
        ? prev
        : [...prev, { team_member_id: selectedMember.id!, name: selectedMember.name! }]
    );
  }, [members]);

  const handleCommentChange = useCallback((value: string) => {
    setCommentValue(value);
    setCharacterLength(value.trim().length);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedTaskId || !projectId) return;

    if (!isCommentValid()) {
      message.error('Please add a comment or attach files');
      return;
    }

    try {
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
        
        // Dispatch event to notify that a comment was created
        // This will trigger scrolling to the new comment
        document.dispatchEvent(new Event('task-comment-create'));
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
  ]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files.length || !selectedTaskId || !projectId) return;

    const files = Array.from(event.target.files);

    if (selectedFiles.length + files.length > MAXIMUM_FILE_COUNT) {
      message.error(`You can only upload a maximum of ${MAXIMUM_FILE_COUNT} files`);
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

      // Expand the comment box if it's not already expanded
      if (!isCommentBoxExpand) {
        setIsCommentBoxExpand(true);
      }
    } catch (error) {
      console.error('Failed to process files:', error);
      message.error('Failed to process files');
    } finally {
      setUploading(false);

      // Reset the file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);

      if (newFiles.length === 0) {
        setAttachmentComment(false);
      }

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
        // Collapsed state - simple textarea with counter
        <Flex
          vertical
          style={{
            width: '100%',
            padding: '12px 0',
            transition: 'all 0.3s ease-in-out',
          }}
        >
          <Mentions
            placeholder={'Add a comment...'}
            options={mentionsOptions}
            autoSize
            maxLength={5000}
            onClick={() => setIsCommentBoxExpand(true)}
            onChange={e => setCharacterLength(e.length)}
            prefix="@"
            filterOption={(input, option) => {
              if (!input) return true;
              const optionLabel = (option as any)?.label || '';
              return optionLabel.toLowerCase().includes(input.toLowerCase());
            }}
            style={{
              minHeight: 60,
              resize: 'none',
              borderRadius: 4,
              transition: 'all 0.3s ease-in-out',
            }}
          />
        </Flex>
      ) : (
        // Expanded state - textarea with buttons
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
                Selected Files (Up to 25MB, Maximum of {MAXIMUM_FILE_COUNT})
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
                      style={{ color: themeWiseColor('#000000d9', '#ffffffd9', themeMode) }}
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
                    Add more files
                  </Button>
                </Flex>
              </Flex>
            </Flex>
          )}

          <Form.Item name={'comment'} style={{ marginBlock: 12 }}>
            <div>
              <Mentions
                placeholder={'Add a comment...'}
                options={mentionsOptions}
                autoSize
                autoFocus
                maxLength={5000}
                value={commentValue}
                onSelect={option => memberSelectHandler(option as IMentionMemberSelectOption)}
                onChange={handleCommentChange}
                prefix="@"
                filterOption={(input, option) => {
                  if (!input) return true;
                  const optionLabel = (option as any)?.label || '';
                  return optionLabel.toLowerCase().includes(input.toLowerCase());
                }}
                style={{
                  minHeight: 100,
                  maxHeight: 200,
                  overflow: 'auto',
                  paddingBlockEnd: 24,
                  resize: 'none',
                  borderRadius: 4,
                  transition: 'all 0.3s ease-in-out',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  bottom: 4,
                  right: 12,
                  color: colors.lightGray,
                  fontSize: 12,
                }}
              >{`${characterLength}/5000`}</span>
            </div>
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
                    ? `Maximum ${MAXIMUM_FILE_COUNT} files allowed`
                    : 'Attach files'
                }
              >
                <Button
                  icon={<PaperClipOutlined />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || selectedFiles.length >= MAXIMUM_FILE_COUNT}
                />
              </Tooltip>

              <Space>
                <Button onClick={handleCancel}>Cancel</Button>
                <Button
                  type="primary"
                  disabled={!isCommentValid()}
                  onClick={handleSubmit}
                  loading={uploading}
                >
                  Comment
                </Button>
              </Space>
            </Flex>
          </Form.Item>
        </Form>
      )}

      <Flex align="center" justify="space-between" style={{ width: '100%', marginTop: 8 }}>
        <Tooltip
          title={
            taskFormViewModel?.task?.created_at
              ? formatDateTimeWithLocale(taskFormViewModel.task.created_at)
              : 'N/A'
          }
        >
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Created{' '}
            {taskFormViewModel?.task?.created_at
              ? calculateTimeDifference(taskFormViewModel.task.created_at)
              : 'N/A'}{' '}
            by {taskFormViewModel?.task?.reporter}
          </Typography.Text>
        </Tooltip>
        <Tooltip
          title={
            taskFormViewModel?.task?.updated_at
              ? formatDateTimeWithLocale(taskFormViewModel.task.updated_at)
              : 'N/A'
          }
        >
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Updated{' '}
            {taskFormViewModel?.task?.updated_at
              ? calculateTimeDifference(taskFormViewModel.task.updated_at)
              : 'N/A'}
          </Typography.Text>
        </Tooltip>
      </Flex>
    </Flex>
  );
};

export default InfoTabFooter;
