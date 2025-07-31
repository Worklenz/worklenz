import { Divider, Form, Input, message, Modal, Typography, Alert } from '@/shared/antd-imports';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { editTeamName, fetchTeams } from '@/features/teams/teamSlice';
import { ITeamGetResponse } from '@/types/teams/team.type';
import { SpamDetector } from '@/utils/spamDetector';

interface EditTeamNameModalProps {
  team: ITeamGetResponse | null;
  isModalOpen: boolean;
  onCancel: () => void;
}

const EditTeamNameModal = ({ team, isModalOpen, onCancel }: EditTeamNameModalProps) => {
  const { t } = useTranslation('settings/teams');
  const dispatch = useAppDispatch();
  const [form] = Form.useForm();
  const [updating, setUpdating] = useState(false);
  const [spamWarning, setSpamWarning] = useState<string>('');

  useEffect(() => {
    if (team) {
      form.setFieldsValue({ name: team.name });
    }
  }, [form, team]);

  // function for form submition
  const handleFormSubmit = async (value: any) => {
    if (!team || !team.id || !value.name) return;
    try {
      setUpdating(true);
      const res = await dispatch(editTeamName({ name: value.name, id: team.id })).unwrap();
      if (res.done) {
        onCancel();
        dispatch(fetchTeams());
      }
      setUpdating(false);
    } catch (error) {
      message.error(t('updateFailed'));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Modal
      title={
        <Typography.Text
          style={{
            fontWeight: 500,
            fontSize: 16,
            width: '100%',
          }}
        >
          {t('editTeamName')}
          <Divider />
        </Typography.Text>
      }
      open={isModalOpen}
      onOk={form.submit}
      okText={t('updateName')}
      onCancel={() => {
        onCancel();
        setUpdating(false);
        form.resetFields();
      }}
      confirmLoading={updating}
      destroyOnClose={true}
    >
      <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
        {spamWarning && (
          <Alert
            message={spamWarning}
            type="warning"
            showIcon
            closable
            onClose={() => setSpamWarning('')}
            style={{ marginBottom: '16px' }}
          />
        )}
        <Form.Item
          name="name"
          label={t('name')}
          rules={[
            {
              required: true,
              message: t('nameRequired'),
            },
          ]}
        >
          <Input 
            placeholder={t('namePlaceholder')} 
            onChange={(e) => {
              const value = e.target.value;
              const spamCheck = SpamDetector.detectSpam(value);
              if (spamCheck.isSpam) {
                setSpamWarning(`Warning: ${spamCheck.reasons.join(', ')}`);
              } else if (SpamDetector.isHighRiskContent(value)) {
                setSpamWarning('Warning: Content appears to contain suspicious links or patterns');
              } else {
                setSpamWarning('');
              }
            }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditTeamNameModal;
