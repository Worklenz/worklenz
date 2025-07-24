import React, { useEffect, useRef } from 'react';
import { Form, Input, Button, List, Alert, message, InputRef } from '@/shared/antd-imports';
import { CloseCircleOutlined, MailOutlined, PlusOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { Typography } from '@/shared/antd-imports';
import { setTeamMembers, setTasks } from '@/features/account-setup/account-setup.slice';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/app/store';
import { validateEmail } from '@/utils/validateEmail';
import { sanitizeInput } from '@/utils/sanitizeInput';
import { Rule } from 'antd/es/form';

const { Title } = Typography;

interface Email {
  id: number;
  value: string;
}

interface MembersStepProps {
  isDarkMode: boolean;
  styles: any;
}

const MembersStep: React.FC<MembersStepProps> = ({ isDarkMode, styles }) => {
  const { t } = useTranslation('account-setup');
  const { teamMembers, organizationName } = useSelector(
    (state: RootState) => state.accountSetupReducer
  );
  const inputRefs = useRef<(InputRef | null)[]>([]);
  const dispatch = useDispatch();
  const [form] = Form.useForm();

  const addEmail = () => {
    if (teamMembers.length == 5) return;

    const newId = teamMembers.length > 0 ? Math.max(...teamMembers.map(t => t.id)) + 1 : 0;
    dispatch(setTeamMembers([...teamMembers, { id: newId, value: '' }]));
    setTimeout(() => {
      inputRefs.current[newId]?.focus();
    }, 0);
  };

  const removeEmail = (id: number) => {
    if (teamMembers.length > 1) {
      dispatch(setTeamMembers(teamMembers.filter(teamMember => teamMember.id !== id)));
    }
  };

  const updateEmail = (id: number, value: string) => {
    const sanitizedValue = sanitizeInput(value);
    dispatch(
      setTeamMembers(
        teamMembers.map(teamMember =>
          teamMember.id === id ? { ...teamMember, value: sanitizedValue } : teamMember
        )
      )
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget as HTMLInputElement;
    if (!input.value.trim()) return;
    e.preventDefault();
    addEmail();
  };

  // Function to set ref that doesn't return anything (void)
  const setInputRef = (index: number) => (el: InputRef | null) => {
    inputRefs.current[index] = el;
  };

  useEffect(() => {
    setTimeout(() => {
      inputRefs.current[teamMembers.length - 1]?.focus();
      // Set initial form values
      const initialValues: Record<string, string> = {};
      teamMembers.forEach(teamMember => {
        initialValues[`email-${teamMember.id}`] = teamMember.value;
      });
      form.setFieldsValue(initialValues);
    }, 200);
  }, []);

  const formRules = {
    email: [
      {
        validator: async (_: any, value: string) => {
          if (!value) return;
          if (!validateEmail(value)) {
            throw new Error(t('invalidEmail'));
          }
        },
      },
    ],
  };

  return (
    <Form
      form={form}
      className="invite-members-form"
      style={{
        minHeight: '300px',
        width: '600px',
        paddingBottom: '1rem',
        marginBottom: '3rem',
        marginTop: '3rem',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Form.Item>
        <Title level={2} style={{ marginBottom: '1rem' }}>
          {t('step3Title')} "<mark>{organizationName}</mark>".
        </Title>
      </Form.Item>
      <Form.Item
        layout="vertical"
        rules={[{ required: true }]}
        label={
          <span className="font-medium">
            {t('step3InputLabel')}&nbsp; <MailOutlined /> {t('maxMembers')}
          </span>
        }
      >
        <List
          dataSource={teamMembers}
          bordered={false}
          itemLayout="vertical"
          renderItem={(teamMember, index) => (
            <List.Item key={teamMember.id}>
              <div className="invite-members-form" style={{ display: 'flex', width: '600px' }}>
                <Form.Item
                  rules={formRules.email as Rule[]}
                  className="w-full"
                  validateTrigger={['onChange', 'onBlur']}
                  name={`email-${teamMember.id}`}
                >
                  <Input
                    placeholder={t('emailPlaceholder')}
                    value={teamMember.value}
                    onChange={e => updateEmail(teamMember.id, e.target.value)}
                    onPressEnter={handleKeyPress}
                    ref={setInputRef(index)}
                    status={teamMember.value && !validateEmail(teamMember.value) ? 'error' : ''}
                    id={`member-${index}`}
                  />
                </Form.Item>
                <Button
                  className="custom-close-button"
                  style={{ marginLeft: '48px' }}
                  type="text"
                  icon={<CloseCircleOutlined />}
                  disabled={teamMembers.length === 1}
                  onClick={() => removeEmail(teamMember.id)}
                />
              </div>
            </List.Item>
          )}
        />
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={addEmail}
          style={{ marginTop: '16px' }}
          disabled={teamMembers.length == 5}
        >
          {t('tasksStepAddAnother')}
        </Button>
        <div
          style={{
            marginTop: '24px',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        ></div>
      </Form.Item>
    </Form>
  );
};

export default MembersStep;
