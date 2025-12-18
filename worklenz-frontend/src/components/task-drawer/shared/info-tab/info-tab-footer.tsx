import {
  Button,
  Flex,
  Form,
  Mentions,
  Space,
  Tooltip,
  Typography,
  message,
} from '@/shared/antd-imports';
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

// Component to render mentions with highlighting using contenteditable
const CustomMentionsInput = ({
  value,
  onChange,
  onSelect,
  themeMode,
  options,
  placeholder,
  autoFocus,
  onClick,
  prefix = '@',
  filterOption,
  style,
  ...props
}: any) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const editableRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Process text to create HTML with highlighted mentions
  const createHighlightedHTML = (text: string) => {
    if (!text) return '';
    
    const parts = text.split(/(@\w+(?:\s+\w+)*)/g);
    const highlightClass = themeMode === 'light' ? 'mention-highlight-light' : 'mention-highlight-dark';
    
    return parts.map(part => {
      if (part.startsWith('@')) {
        return `<span class="${highlightClass}" contenteditable="false">${part}</span>`;
      }
      return part.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }).join('');
  };

  // Extract plain text from HTML
  const extractPlainText = (html: string) => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || '';
  };

  // Handle input changes
  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const text = extractPlainText(e.currentTarget.innerHTML);
    onChange(text);

    // Check if user is typing a mention
    const lastAtIndex = text.lastIndexOf('@', cursorPosition);
    if (lastAtIndex !== -1) {
      const textAfterAt = text.slice(lastAtIndex + 1, cursorPosition);
      
      if (!textAfterAt.includes(' ') && textAfterAt.length >= 0) {
        // Filter options
        const filtered = options.filter((opt: any) => 
          filterOption ? filterOption(textAfterAt, opt) : true
        );
        setFilteredOptions(filtered);
        setIsDropdownOpen(filtered.length > 0);
        setSelectedIndex(0);
      } else {
        setIsDropdownOpen(false);
      }
    } else {
      setIsDropdownOpen(false);
    }
  };

  // Handle option selection
  const selectOption = (option: any) => {
    const text = value || '';
    const lastAtIndex = text.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const beforeAt = text.slice(0, lastAtIndex);
      const afterMention = text.slice(cursorPosition);
      const newText = beforeAt + '@' + option.value + ' ' + afterMention;
      
      onChange(newText);
      if (onSelect) onSelect(option);
    }
    
    setIsDropdownOpen(false);
    editableRef.current?.focus();
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isDropdownOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filteredOptions.length > 0) {
        e.preventDefault();
        selectOption(filteredOptions[selectedIndex]);
      } else if (e.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    }
  };

  // Update contenteditable with highlighted HTML
  useEffect(() => {
    if (editableRef.current && value !== undefined) {
      const highlighted = createHighlightedHTML(value);
      if (editableRef.current.innerHTML !== highlighted) {
        const selection = window.getSelection();
        const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        const offset = range ? range.startOffset : 0;
        
        editableRef.current.innerHTML = highlighted;
        
        // Restore cursor position
        if (range && editableRef.current.childNodes.length > 0) {
          try {
            const newRange = document.createRange();
            newRange.setStart(editableRef.current.childNodes[0] || editableRef.current, offset);
            newRange.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(newRange);
          } catch (e) {
            // Cursor positioning failed, ignore
          }
        }
      }
    }
  }, [value, themeMode]);

  // Auto focus
  useEffect(() => {
    if (autoFocus && editableRef.current) {
      editableRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div className="custom-mentions-wrapper" style={{ position: 'relative' }}>
      <div
        ref={editableRef}
        contentEditable
        className={`custom-mentions-editable theme-${themeMode}`}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onClick={onClick}
        data-placeholder={placeholder}
        style={{
          ...style,
          minHeight: style?.minHeight || 60,
          maxHeight: style?.maxHeight || 200,
          overflowY: 'auto',
          padding: '4px 11px',
          border: `1px solid ${themeWiseColor('#d9d9d9', '#434343', themeMode)}`,
          borderRadius: style?.borderRadius || 4,
          backgroundColor: themeWiseColor('#fff', '#141414', themeMode),
          color: themeWiseColor('rgba(0, 0, 0, 0.85)', 'rgba(255, 255, 255, 0.85)', themeMode),
          outline: 'none',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
        }}
      />
      
      {isDropdownOpen && filteredOptions.length > 0 && (
        <div 
          ref={dropdownRef}
          className={`mentions-dropdown theme-${themeMode}`}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            backgroundColor: themeWiseColor('#fff', '#1f1f1f', themeMode),
            border: `1px solid ${themeWiseColor('#d9d9d9', '#434343', themeMode)}`,
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            maxHeight: 200,
            overflowY: 'auto',
            zIndex: 1050,
          }}
        >
          {filteredOptions.map((option, index) => (
            <div
              key={option.key}
              className={`mentions-option ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => selectOption(option)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                backgroundColor: index === selectedIndex 
                  ? themeWiseColor('#f5f5f5', '#2a2a2a', themeMode)
                  : 'transparent',
                color: themeWiseColor('rgba(0, 0, 0, 0.85)', 'rgba(255, 255, 255, 0.85)', themeMode),
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

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
          : [...prev, { team_member_id: selectedMember.id!, name: selectedMember.name! }]
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
      message.error(t('taskInfoTab.comments.addCommentError'));
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
  }, [commentValue, selectedMembers, selectedFiles, selectedTaskId, projectId, form, isCommentValid, t]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files.length || !selectedTaskId || !projectId) return;

    const files = Array.from(event.target.files);

    if (selectedFiles.length + files.length > MAXIMUM_FILE_COUNT) {
      message.error(t('taskInfoTab.comments.maxFilesError', { count: MAXIMUM_FILE_COUNT }));
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
      message.error(t('taskInfoTab.comments.processFilesError'));
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
        <Flex
          vertical
          style={{
            width: '100%',
            padding: '12px 0',
            transition: 'all 0.3s ease-in-out',
          }}
        >
          <CustomMentionsInput
            placeholder={t('taskInfoTab.comments.addCommentPlaceholder')}
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
                {t('taskInfoTab.comments.selectedFiles', { count: MAXIMUM_FILE_COUNT })}
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
                    {t('taskInfoTab.comments.addMoreFiles')}
                  </Button>
                </Flex>
              </Flex>
            </Flex>
          )}

          <Form.Item name={'comment'} style={{ marginBlock: 12 }}>
            <div style={{ position: 'relative' }}>
              <CustomMentionsInput
                placeholder={t('taskInfoTab.comments.addCommentPlaceholder')}
                options={mentionsOptions}
                autoFocus
                value={commentValue}
                onSelect={(option: any) => memberSelectHandler(option as IMentionMemberSelectOption)}
                onChange={handleCommentChange}
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
                    ? t('taskInfoTab.comments.maxFilesError', { count: MAXIMUM_FILE_COUNT })
                    : t('taskInfoTab.comments.attachFiles')
                }
              >
                <Button
                  icon={<PaperClipOutlined />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || selectedFiles.length >= MAXIMUM_FILE_COUNT}
                />
              </Tooltip>

              <Space>
                <Button onClick={handleCancel}>{t('taskInfoTab.comments.cancel')}</Button>
                <Button
                  type="primary"
                  disabled={!isCommentValid()}
                  onClick={handleSubmit}
                  loading={uploading}
                >
                  {t('taskInfoTab.comments.commentButton')}
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
              time: createdFromNow,
              user: taskFormViewModel?.task?.reporter || '',
            })}
          </Typography.Text>
        </Tooltip>
        <Tooltip title={updatedFromNow !== 'N/A' ? `Updated ${updatedFromNow}` : 'N/A'}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('taskInfoTab.comments.updatedTime', {
              time: updatedFromNow,
            })}
          </Typography.Text>
        </Tooltip>
      </Flex>
    </Flex>
  );
};

export default InfoTabFooter;