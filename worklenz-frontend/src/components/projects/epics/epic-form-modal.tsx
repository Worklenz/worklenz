import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Flex, Form, Input, Modal, Select, message, theme } from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAuthService } from '@/hooks/useAuth';
import { projectEpicsApiService } from '@/api/project-epics/project-epics.api.service';
import { upsertEpic } from '@/features/projects/singleProject/epics/epics.slice';
import { useProjectMemberOptions } from '@/hooks/useProjectMemberOptions';
import { IProjectEpic } from '@/types/project/projectEpic.types';

interface EpicFormModalProps {
  open: boolean;
  projectId: string;
  epic: IProjectEpic | null;
  onClose: () => void;
}

export const EpicFormModal = ({ open, projectId, epic, onClose }: EpicFormModalProps) => {
  const { t } = useTranslation('project-view');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const currentTeamMemberId = useAuthService().getCurrentSession()?.team_member_id ?? null;
  const [form] = Form.useForm<EpicFormValues>();
  const { options: ownerOptions, isLoading: isLoadingMembers } = useProjectMemberOptions(
    projectId,
    open
  );
  const [isSaving, setIsSaving] = useState(false);
  const isEditMode = !!epic;
  const selectedColor = Form.useWatch('color_code', form) ?? EPIC_COLORS[0];

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      name: epic?.name ?? '',
      description: epic?.description ?? '',
      owner_id: epic ? epic.owner_id : currentTeamMemberId,
      color_code: epic?.color_code ?? EPIC_COLORS[0],
    });
  }, [currentTeamMemberId, epic, form, open]);

  const handleSubmit = async (values: EpicFormValues) => {
    setIsSaving(true);
    try {
      const body = {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        owner_id: values.owner_id || null,
        color_code: values.color_code,
        is_archived: epic?.is_archived ?? false,
      };
      const response = epic
        ? await projectEpicsApiService.update(projectId, epic.id, body)
        : await projectEpicsApiService.create(projectId, body);
      if (!response.done || !response.body) throw new Error(response.message);

      dispatch(upsertEpic(response.body));
      message.success(
        isEditMode
          ? t('epicUpdated', { defaultValue: 'Epic updated' })
          : t('epicCreated', { defaultValue: 'Epic created' })
      );
      onClose();
    } catch {
      message.error(
        isEditMode
          ? t('epicUpdateError', { defaultValue: 'Could not update the Epic' })
          : t('epicCreateError', { defaultValue: 'Could not create the Epic' })
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      destroyOnHidden
      title={
        <Flex align="center" gap={8}>
          <EpicTypeBadge />
          {isEditMode
            ? t('editEpicTitle', { defaultValue: 'Edit Epic' })
            : t('createEpicTitle', { defaultValue: 'Create Epic' })}
        </Flex>
      }
      footer={
        <Flex justify="end" gap={8}>
          <Button onClick={onClose}>{t('cancel', { defaultValue: 'Cancel' })}</Button>
          <Button type="primary" loading={isSaving} onClick={() => form.submit()}>
            {isEditMode
              ? t('saveEpic', { defaultValue: 'Save Epic' })
              : t('createEpicTitle', { defaultValue: 'Create Epic' })}
          </Button>
        </Flex>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark>
        <Form.Item
          name="name"
          label={t('epicName', { defaultValue: 'Epic name' })}
          rules={[
            {
              required: true,
              whitespace: true,
              message: t('epicNameRequired', { defaultValue: 'Please enter an Epic name' }),
            },
            { max: NAME_MAX_LENGTH },
          ]}
        >
          <Input
            autoFocus
            maxLength={NAME_MAX_LENGTH}
            placeholder={t('epicNamePlaceholder', { defaultValue: 'e.g. Reporting Platform' })}
          />
        </Form.Item>

        <Form.Item
          name="description"
          label={t('epicDescription', { defaultValue: 'Description' })}
          rules={[{ max: DESCRIPTION_MAX_LENGTH }]}
        >
          <Input.TextArea
            rows={3}
            maxLength={DESCRIPTION_MAX_LENGTH}
            placeholder={t('epicDescriptionPlaceholder', {
              defaultValue: 'What outcome will this Epic deliver?',
            })}
          />
        </Form.Item>

        <Form.Item name="owner_id" label={t('epicOwner', { defaultValue: 'Owner' })}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            loading={isLoadingMembers}
            options={ownerOptions}
            placeholder={t('epicNoOwner', { defaultValue: 'No owner' })}
          />
        </Form.Item>

        <Form.Item
          name="color_code"
          label={t('epicColor', { defaultValue: 'Color' })}
          style={{ marginBottom: 0 }}
        >
          <Flex gap={8} role="radiogroup" aria-label={t('epicColor', { defaultValue: 'Color' })}>
            {EPIC_COLORS.map((color, index) => {
              const isSelected = selectedColor === color;
              return (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={t('epicColorOption', {
                    defaultValue: 'Color {{index}}',
                    index: index + 1,
                  })}
                  onClick={() => form.setFieldValue('color_code', color)}
                  className="w-7 h-7 rounded-md cursor-pointer border-0 transition-shadow duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    backgroundColor: color,
                    boxShadow: isSelected
                      ? `0 0 0 2px ${token.colorBgContainer}, 0 0 0 4px ${color}`
                      : 'none',
                  }}
                />
              );
            })}
          </Flex>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export const EpicTypeBadge = () => (
  <span
    aria-hidden="true"
    className="inline-grid place-items-center w-5 h-5 rounded text-[10px] font-extrabold text-white flex-none"
    style={{ backgroundColor: EPIC_COLORS[0] }}
  >
    E
  </span>
);

const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 1000;
export const EPIC_COLORS = ['#722ed1', '#1677ff', '#eb2f96', '#13c2c2', '#fa8c16'];

interface EpicFormValues {
  name: string;
  description?: string;
  owner_id?: string | null;
  color_code: string;
}
