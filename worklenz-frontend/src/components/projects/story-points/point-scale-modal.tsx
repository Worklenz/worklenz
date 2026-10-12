import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Flex, Form, Input, Modal, message } from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { storyPointsApiService } from '@/api/story-points/story-points.api.service';
import { mergeProject } from '@/features/project/project.slice';
import {
  DEFAULT_STORY_POINT_SCALE,
  formatStoryPoints,
  parseStoryPointScale,
} from '@/lib/project/story-points';

interface PointScaleModalProps {
  open: boolean;
  projectId: string;
  onClose: () => void;
}

export const PointScaleModal = ({ open, projectId, onClose }: PointScaleModalProps) => {
  const { t } = useTranslation('project-view');
  const dispatch = useAppDispatch();
  const scale = useAppSelector(state => state.projectReducer.project?.story_point_scale);
  const [form] = Form.useForm<PointScaleFormValues>();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const currentScale = scale?.length ? scale : DEFAULT_STORY_POINT_SCALE;
    form.setFieldsValue({ scale: currentScale.map(formatStoryPoints).join(', ') });
  }, [form, open, scale]);

  const handleResetToDefault = () => {
    form.setFieldsValue({ scale: DEFAULT_STORY_POINT_SCALE.join(', ') });
  };

  const handleSubmit = async (values: PointScaleFormValues) => {
    const parsedScale = parseStoryPointScale(values.scale);
    if (!parsedScale) return;

    setIsSaving(true);
    try {
      const response = await storyPointsApiService.updateScale(projectId, parsedScale);
      if (!response.done || !response.body) throw new Error(response.message);
      dispatch(mergeProject({ story_point_scale: response.body.story_point_scale }));
      message.success(t('pointScaleSaved', { defaultValue: 'Point scale saved' }));
      onClose();
    } catch {
      message.error(t('pointScaleSaveError', { defaultValue: 'Could not save the point scale' }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      destroyOnHidden
      title={t('pointScaleTitle', { defaultValue: 'Story point scale' })}
      footer={
        <Flex justify="space-between" gap={8}>
          <Button type="link" onClick={handleResetToDefault} style={{ paddingInline: 0 }}>
            {t('pointScaleReset', { defaultValue: 'Reset to default' })}
          </Button>
          <Flex gap={8}>
            <Button onClick={onClose}>{t('cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="primary" loading={isSaving} onClick={() => form.submit()}>
              {t('save', { defaultValue: 'Save' })}
            </Button>
          </Flex>
        </Flex>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
        <Form.Item
          name="scale"
          label={t('pointScaleLabel', { defaultValue: 'Story point scale' })}
          extra={t('pointScaleHelp', {
            defaultValue:
              'Enter comma-separated values. These options appear in Backlog rows and issue details.',
          })}
          rules={[
            {
              validator: (_, value: string | undefined) =>
                parseStoryPointScale(value ?? '')
                  ? Promise.resolve()
                  : Promise.reject(
                      new Error(
                        t('pointScaleInvalid', {
                          defaultValue: 'Use comma-separated, non-negative numbers only.',
                        })
                      )
                    ),
            },
          ]}
        >
          <Input autoFocus inputMode="decimal" placeholder={DEFAULT_STORY_POINT_SCALE.join(', ')} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

interface PointScaleFormValues {
  scale: string;
}
