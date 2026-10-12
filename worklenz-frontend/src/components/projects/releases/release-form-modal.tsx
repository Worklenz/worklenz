import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';
import {
  Button,
  Col,
  DatePicker,
  Flex,
  Form,
  Input,
  Modal,
  Row,
  Typography,
  message,
} from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { projectReleasesApiService } from '@/api/project-releases/project-releases.api.service';
import { upsertRelease } from '@/features/projects/singleProject/releases/releases.slice';
import { IProjectRelease } from '@/types/project/projectRelease.types';
import {
  RELEASE_DESCRIPTION_MAX_LENGTH,
  RELEASE_NAME_MAX_LENGTH,
  isAnnouncedApiError,
  suggestNextReleaseName,
} from './release-utils';
import { ReleaseSelectionCount, ReleaseWorkSelector } from './release-work-picker-modal';

interface ReleaseFormModalProps {
  open: boolean;
  projectId: string;
  /** Release being edited; `null` creates a new release. */
  release: IProjectRelease | null;
  /** Lets a new release be created together with its work items. */
  canSelectWork?: boolean;
  onClose: () => void;
  onSaved?: (release: IProjectRelease, isNew: boolean) => void;
}

export const ReleaseFormModal = ({
  open,
  projectId,
  release,
  canSelectWork = false,
  onClose,
  onSaved,
}: ReleaseFormModalProps) => {
  const { t } = useTranslation('project-view');
  const dispatch = useAppDispatch();
  const releases = useAppSelector(state => state.releasesReducer.releases);
  const [form] = Form.useForm<ReleaseFormValues>();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isEditMode = !!release;
  const isWorkSelectionShown = !isEditMode && canSelectWork;

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
    form.setFieldsValue({
      name: release?.name ?? suggestNextReleaseName(releases),
      description: release?.description ?? '',
      target_date: release?.target_date ? dayjs(release.target_date) : null,
    });
    // Only seed the form when the modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, open, release]);

  /** Links the selected work to a just-created release; returns the refreshed release. */
  const addSelectedWork = async (created: IProjectRelease): Promise<IProjectRelease> => {
    try {
      const response = await projectReleasesApiService.addItems(
        projectId,
        created.id,
        Array.from(selectedIds)
      );
      if (!response.done || !response.body) return created;
      message.success(
        t('releaseCreatedWithItems', {
          defaultValue: '{{name}} created with {{count}} work item(s)',
          name: created.name,
          count: response.body.added_count,
        })
      );
      return response.body.release;
    } catch (error) {
      if (!isAnnouncedApiError(error)) {
        message.warning(
          t('releaseCreatedItemsError', {
            defaultValue: '{{name}} created, but the work items could not be added',
            name: created.name,
          })
        );
      }
      return created;
    }
  };

  const handleSubmit = async (values: ReleaseFormValues) => {
    setIsSaving(true);
    try {
      const body = {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        target_date: values.target_date ? values.target_date.format('YYYY-MM-DD') : null,
      };
      const response = release
        ? await projectReleasesApiService.update(projectId, release.id, body)
        : await projectReleasesApiService.create(projectId, body);
      if (!response.done || !response.body) return;

      let savedRelease = response.body;
      if (isEditMode) {
        message.success(t('releaseUpdated', { defaultValue: 'Release updated' }));
      } else if (isWorkSelectionShown && selectedIds.size) {
        savedRelease = await addSelectedWork(savedRelease);
      } else {
        message.success(
          t('releaseCreated', { defaultValue: '{{name}} created', name: savedRelease.name })
        );
      }

      dispatch(upsertRelease(savedRelease));
      onSaved?.(savedRelease, !isEditMode);
      onClose();
    } catch (error) {
      if (isAnnouncedApiError(error)) return;
      message.error(
        isEditMode
          ? t('releaseUpdateError', { defaultValue: 'Could not update the release' })
          : t('releaseCreateError', { defaultValue: 'Could not create the release' })
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={isWorkSelectionShown ? 780 : 520}
      destroyOnHidden
      title={
        isEditMode
          ? t('editReleaseTitle', { defaultValue: 'Edit release' })
          : t('newReleaseTitle', { defaultValue: 'New release' })
      }
      footer={
        <Flex align="center" justify="end" gap={8}>
          {isWorkSelectionShown && <ReleaseSelectionCount count={selectedIds.size} />}
          <Button onClick={onClose}>{t('cancel', { defaultValue: 'Cancel' })}</Button>
          <Button type="primary" loading={isSaving} onClick={() => form.submit()}>
            {isEditMode
              ? t('saveChanges', { defaultValue: 'Save changes' })
              : t('createRelease', { defaultValue: 'Create release' })}
          </Button>
        </Flex>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark>
        <Row gutter={12}>
          <Col xs={24} sm={isWorkSelectionShown ? 12 : 24}>
            <Form.Item
              name="name"
              label={t('releaseName', { defaultValue: 'Version name' })}
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: t('releaseNameRequired', { defaultValue: 'Please enter a version name' }),
                },
                { max: RELEASE_NAME_MAX_LENGTH },
              ]}
            >
              <Input
                autoFocus
                maxLength={RELEASE_NAME_MAX_LENGTH}
                placeholder={t('releaseNamePlaceholder', { defaultValue: 'e.g. v2.1.0' })}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={isWorkSelectionShown ? 12 : 24}>
            <Form.Item
              name="target_date"
              label={t('releaseTargetDate', { defaultValue: 'Target date' })}
            >
              <DatePicker
                className="w-full"
                placeholder={t('releaseTargetDatePlaceholder', { defaultValue: 'Select a date' })}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="description"
          label={t('releaseDescription', { defaultValue: 'Description' })}
          rules={[{ max: RELEASE_DESCRIPTION_MAX_LENGTH }]}
          style={{ marginBottom: isWorkSelectionShown ? 16 : 0 }}
        >
          <Input.TextArea
            rows={isWorkSelectionShown ? 2 : 3}
            maxLength={RELEASE_DESCRIPTION_MAX_LENGTH}
            placeholder={t('releaseDescriptionPlaceholder', {
              defaultValue: 'What ships in this version?',
            })}
          />
        </Form.Item>
      </Form>

      {isWorkSelectionShown && (
        <section aria-label={t('releaseWorkSection', { defaultValue: 'Work items' })}>
          <Flex align="baseline" gap={6} className="mb-2">
            <Typography.Text strong>
              {t('releaseWorkSection', { defaultValue: 'Work items' })}
            </Typography.Text>
            <Typography.Text type="secondary" className="text-xs">
              {t('releaseWorkSectionHint', {
                defaultValue: 'Optional — select issues or Epics to ship in this version.',
              })}
            </Typography.Text>
          </Flex>
          <ReleaseWorkSelector
            projectId={projectId}
            isActive={open}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            listMaxHeight={280}
          />
        </section>
      )}
    </Modal>
  );
};

interface ReleaseFormValues {
  name: string;
  description?: string;
  target_date?: Dayjs | null;
}
