import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Checkbox,
  Col,
  Flex,
  Form,
  Input,
  InputRef,
  Modal,
  Row,
  Select,
  Typography,
  message,
} from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useEnsureProjectEpics } from '@/hooks/useEnsureProjectEpics';
import { useProjectMemberOptions } from '@/hooks/useProjectMemberOptions';
import { softwareIssuesApiService } from '@/api/software-issues/software-issues.api.service';
import { projectEpicsApiService } from '@/api/project-epics/project-epics.api.service';
import { closeCreateIssueModal } from '@/features/projects/singleProject/create-issue/create-issue-modal.slice';
import { fetchProjectEpics, upsertEpic } from '@/features/projects/singleProject/epics/epics.slice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';
import { fetchEnhancedKanbanGroups } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { setRefreshTimestamp } from '@/features/project/project.slice';
import { selectAllTasksArray } from '@/features/task-management/task-management.selectors';
import { formatStoryPoints, getStoryPointOptions } from '@/lib/project/story-points';
import { getSoftwareProjectLabels } from '@/lib/project/software-project';
import { EPIC_COLORS } from '@/components/projects/epics/epic-form-modal';
import {
  NO_EPIC_VALUE,
  useEpicSelectOptions,
} from '@/components/projects/epics/use-epic-select-options';
import { IssueTypeBadge, getIssueTypeLabel } from '@/components/projects/software/issue-type-badge';
import { CreatableIssueType } from '@/types/project/softwareIssue.types';

interface CreateIssueModalProps {
  projectId: string;
}

/** "Create issue" dialog for software projects (Summary, Description, Type, Assignee, Epic, Estimate). */
export const CreateIssueModal = ({ projectId }: CreateIssueModalProps) => {
  const { t } = useTranslation('project-view');
  const dispatch = useAppDispatch();
  const [form] = Form.useForm<CreateIssueFormValues>();
  const summaryInputRef = useRef<InputRef>(null);
  const { isOpen, sprintId, statusId } = useAppSelector(state => state.createIssueModalReducer);
  const project = useAppSelector(state => state.projectReducer.project);
  const phaseList = useAppSelector(state => state.phaseReducer.phaseList);
  const epics = useAppSelector(state => state.epicsReducer.epics);
  const allTasks = useAppSelector(selectAllTasksArray);
  const [isSaving, setIsSaving] = useState(false);

  const { options: memberOptions, isLoading: isLoadingMembers } = useProjectMemberOptions(
    projectId,
    isOpen
  );
  useEnsureProjectEpics(isOpen ? projectId : null);
  const epicOptions = useEpicSelectOptions(null);

  const issueType = Form.useWatch('issue_type', form) ?? 'task';
  const isEpicType = issueType === 'epic';
  const isSubtaskType = issueType === 'subtask';
  const sprintName = sprintId ? phaseList.find(phase => phase.id === sprintId)?.name : null;
  const destinationLabel = sprintName ?? getSoftwareProjectLabels(project?.project_type).unmapped;

  const typeOptions = useMemo(
    () =>
      CREATABLE_ISSUE_TYPES.map(type => ({
        value: type,
        label: (
          <Flex align="center" gap={8}>
            <IssueTypeBadge type={type} showTooltip={false} />
            {getIssueTypeLabel(type, t)}
          </Flex>
        ),
      })),
    [t]
  );

  const estimateOptions = useMemo(
    () => [
      { value: NO_ESTIMATE_VALUE, label: t('createIssueNoEstimate', { defaultValue: 'No estimate' }) },
      ...getStoryPointOptions(project?.story_point_scale).map(point => ({
        value: String(point),
        label: formatStoryPoints(point),
      })),
    ],
    [project?.story_point_scale, t]
  );

  const parentOptions = useMemo(
    () =>
      allTasks
        .filter(task => !task.parent_task_id && !task.is_parent_container)
        .map(task => ({
          value: task.id,
          label: [task.task_key, task.title || task.name].filter(Boolean).join(' '),
        })),
    [allTasks]
  );

  useEffect(() => {
    if (!isOpen) return;
    form.resetFields();
  }, [form, isOpen]);

  const handleClose = () => dispatch(closeCreateIssueModal());

  const refreshProjectData = () => {
    void dispatch(fetchTasksV3(projectId));
    void dispatch(fetchPhasesByProjectId(projectId));
    void dispatch(fetchEnhancedKanbanGroups(projectId));
    void dispatch(fetchProjectEpics(projectId));
    dispatch(setRefreshTimestamp());
  };

  const createEpic = async (values: CreateIssueFormValues) => {
    const response = await projectEpicsApiService.create(projectId, {
      name: values.name.trim(),
      description: values.description?.trim() || null,
      owner_id: values.assignee_id ?? null,
      color_code: EPIC_COLORS[epics.length % EPIC_COLORS.length],
      is_archived: false,
    });
    if (!response.done || !response.body) throw new Error(response.message);
    dispatch(upsertEpic(response.body));
    message.success(
      t('createIssueEpicCreated', { defaultValue: 'Epic {{name}} created', name: response.body.name })
    );
  };

  const createIssue = async (values: CreateIssueFormValues) => {
    if (values.issue_type === 'epic') return;
    const response = await softwareIssuesApiService.create({
      project_id: projectId,
      name: values.name.trim(),
      description: values.description?.trim() || null,
      issue_type: values.issue_type,
      assignee_id: values.assignee_id ?? null,
      epic_id: values.epic_id && values.epic_id !== NO_EPIC_VALUE ? values.epic_id : null,
      story_points:
        values.story_points && values.story_points !== NO_ESTIMATE_VALUE
          ? Number(values.story_points)
          : null,
      phase_id: values.issue_type === 'subtask' ? null : sprintId,
      status_id: statusId,
      parent_task_id: values.issue_type === 'subtask' ? values.parent_task_id ?? null : null,
    });
    if (!response.done || !response.body) throw new Error(response.message);
    message.success(
      response.body.task_key
        ? t('createIssueCreated', {
            defaultValue: 'Issue {{key}} created',
            key: response.body.task_key,
          })
        : t('createIssueCreatedNoKey', { defaultValue: 'Issue created' })
    );
  };

  const handleSubmit = async (values: CreateIssueFormValues) => {
    setIsSaving(true);
    try {
      if (values.issue_type === 'epic') {
        await createEpic(values);
      } else {
        await createIssue(values);
      }
      refreshProjectData();

      if (!values.create_another) {
        handleClose();
        return;
      }
      form.resetFields();
      form.setFieldValue('create_another', true);
      summaryInputRef.current?.focus();
    } catch (error: unknown) {
      message.error(
        (error as { message?: string } | undefined)?.message ||
          t('createIssueError', { defaultValue: 'Could not create the issue. Please try again.' })
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onCancel={handleClose}
      destroyOnHidden
      width={560}
      title={
        <Flex align="center" gap={8}>
          <IssueTypeBadge type={issueType} showTooltip={false} />
          <span>{t('createIssueTitle', { defaultValue: 'Create issue' })}</span>
          {!isEpicType && !isSubtaskType && (
            <Typography.Text type="secondary" className="text-xs font-normal">
              {t('createIssueDestination', { defaultValue: 'in {{name}}', name: destinationLabel })}
            </Typography.Text>
          )}
        </Flex>
      }
      footer={
        <Flex justify="end" gap={8}>
          <Button onClick={handleClose}>{t('cancel', { defaultValue: 'Cancel' })}</Button>
          <Button type="primary" loading={isSaving} onClick={() => form.submit()}>
            {t('createIssueSubmit', { defaultValue: 'Create' })}
          </Button>
        </Flex>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark
        initialValues={INITIAL_VALUES}
      >
        <Form.Item
          name="name"
          label={t('createIssueSummary', { defaultValue: 'Summary' })}
          rules={[
            {
              required: true,
              whitespace: true,
              message: t('createIssueSummaryRequired', { defaultValue: 'Summary is required.' }),
            },
            { max: isEpicType ? EPIC_NAME_MAX_LENGTH : SUMMARY_MAX_LENGTH },
          ]}
        >
          <Input
            ref={summaryInputRef}
            autoFocus
            maxLength={isEpicType ? EPIC_NAME_MAX_LENGTH : SUMMARY_MAX_LENGTH}
            placeholder={t('createIssueSummaryPlaceholder', {
              defaultValue: 'e.g. Fix login redirect loop',
            })}
          />
        </Form.Item>

        <Form.Item
          name="description"
          label={t('createIssueDescription', { defaultValue: 'Description' })}
          rules={[{ max: isEpicType ? EPIC_DESCRIPTION_MAX_LENGTH : DESCRIPTION_MAX_LENGTH }]}
        >
          <Input.TextArea
            rows={3}
            maxLength={isEpicType ? EPIC_DESCRIPTION_MAX_LENGTH : DESCRIPTION_MAX_LENGTH}
            placeholder={t('createIssueDescriptionPlaceholder', {
              defaultValue: 'Add a description…',
            })}
          />
        </Form.Item>

        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="issue_type" label={t('createIssueType', { defaultValue: 'Type' })}>
              <Select options={typeOptions} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="assignee_id"
              label={
                isEpicType
                  ? t('createIssueOwner', { defaultValue: 'Owner' })
                  : t('createIssueAssignee', { defaultValue: 'Assignee' })
              }
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                loading={isLoadingMembers}
                options={memberOptions}
                placeholder={
                  isEpicType
                    ? t('epicNoOwner', { defaultValue: 'No owner' })
                    : t('createIssueUnassigned', { defaultValue: 'Unassigned' })
                }
              />
            </Form.Item>
          </Col>
        </Row>

        {isSubtaskType && (
          <Form.Item
            name="parent_task_id"
            label={t('createIssueParent', { defaultValue: 'Parent issue' })}
            rules={[
              {
                required: true,
                message: t('createIssueParentRequired', {
                  defaultValue: 'Choose the issue this subtask belongs to.',
                }),
              },
            ]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={parentOptions}
              placeholder={t('createIssueParentPlaceholder', { defaultValue: 'Search issues' })}
              notFoundContent={t('createIssueNoParents', { defaultValue: 'No issues found' })}
            />
          </Form.Item>
        )}

        {isEpicType ? (
          <Typography.Paragraph type="secondary" className="text-xs">
            {t('createIssueEpicHint', {
              defaultValue:
                'The Epic will be available immediately for Backlog filtering and issue assignment.',
            })}
          </Typography.Paragraph>
        ) : (
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="epic_id" label={t('createIssueEpic', { defaultValue: 'Epic' })}>
                <Select options={epicOptions} popupMatchSelectWidth={false} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="story_points"
                label={t('createIssueEstimate', { defaultValue: 'Estimate' })}
              >
                <Select options={estimateOptions} />
              </Form.Item>
            </Col>
          </Row>
        )}

        <Form.Item name="create_another" valuePropName="checked" style={{ marginBottom: 0 }}>
          <Checkbox>{t('createIssueAnother', { defaultValue: 'Create another' })}</Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
};

interface CreateIssueFormValues {
  name: string;
  description?: string;
  issue_type: CreatableIssueType;
  assignee_id?: string | null;
  epic_id?: string;
  story_points?: string;
  parent_task_id?: string | null;
  create_another?: boolean;
}

const CREATABLE_ISSUE_TYPES: CreatableIssueType[] = ['task', 'story', 'bug', 'subtask', 'epic'];
const NO_ESTIMATE_VALUE = '__no_estimate__';
const SUMMARY_MAX_LENGTH = 250;
const DESCRIPTION_MAX_LENGTH = 5000;
const EPIC_NAME_MAX_LENGTH = 100;
const EPIC_DESCRIPTION_MAX_LENGTH = 1000;

const INITIAL_VALUES: Partial<CreateIssueFormValues> = {
  issue_type: 'task',
  epic_id: NO_EPIC_VALUE,
  story_points: NO_ESTIMATE_VALUE,
  create_another: false,
};

export default CreateIssueModal;
