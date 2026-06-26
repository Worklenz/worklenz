import React, { useEffect, useRef, useState } from 'react';
import {
  Form,
  Input,
  Button,
  Typography,
  Card,
  Avatar,
  Tag,
  Alert,
  Space,
  Dropdown,
  MenuProps,
} from '@/shared/antd-imports';
import {
  CloseCircleOutlined,
  MailOutlined,
  PlusOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  GlobalOutlined,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { setTeamMembers } from '@/features/account-setup/account-setup.slice';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/app/store';
import { validateEmail } from '@/utils/validateEmail';
import { sanitizeInput } from '@/utils/sanitizeInput';
import { setLanguage } from '@/features/i18n/localesSlice';

const { Title, Paragraph, Text } = Typography;

interface Email {
  id: number;
  value: string;
}

interface MembersStepProps {
  isDarkMode: boolean;
  styles: any;
  token?: any;
}

const getEmailSuggestions = (orgName?: string) => {
  if (!orgName) return [];
  const cleanOrgName = orgName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [
    `info@${cleanOrgName}.com`,
    `team@${cleanOrgName}.com`,
    `hello@${cleanOrgName}.com`,
    `contact@${cleanOrgName}.com`,
  ];
};

const getRoleSuggestions = (t: any) => [
  { role: 'Designer', icon: '🎨', description: t('roleSuggestions.designer') },
  { role: 'Developer', icon: '💻', description: t('roleSuggestions.developer') },
  { role: 'Project Manager', icon: '📊', description: t('roleSuggestions.projectManager') },
  { role: 'Marketing', icon: '📢', description: t('roleSuggestions.marketing') },
  { role: 'Sales', icon: '💼', description: t('roleSuggestions.sales') },
  { role: 'Operations', icon: '⚙️', description: t('roleSuggestions.operations') },
];

const MembersStep: React.FC<MembersStepProps> = ({ isDarkMode, styles, token }) => {
  const { t, i18n } = useTranslation('account-setup');
  const { teamMembers, organizationName } = useSelector(
    (state: RootState) => state.accountSetupReducer
  );
  const { language } = useSelector((state: RootState) => state.localesReducer);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const dispatch = useDispatch();
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [validatedEmails, setValidatedEmails] = useState<Set<number>>(new Set());

  const emailSuggestions = getEmailSuggestions(organizationName);

  const addEmail = () => {
    if (teamMembers.length >= 5) return;
    const newId = teamMembers.length > 0 ? Math.max(...teamMembers.map(t => t.id)) + 1 : 0;
    dispatch(setTeamMembers([...teamMembers, { id: newId, value: '' }]));
    setTimeout(() => inputRefs.current[teamMembers.length]?.focus(), 100);
  };

  const removeEmail = (id: number) => {
    if (teamMembers.length > 1)
      dispatch(setTeamMembers(teamMembers.filter(teamMember => teamMember.id !== id)));
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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      const input = e.currentTarget as HTMLInputElement;
      if (input.value.trim() && validateEmail(input.value.trim())) {
        e.preventDefault();
        if (index === teamMembers.length - 1 && teamMembers.length < 5) addEmail();
        else if (index < teamMembers.length - 1) inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    const emptyEmailIndex = teamMembers.findIndex(member => !member.value.trim());
    if (emptyEmailIndex !== -1) {
      updateEmail(teamMembers[emptyEmailIndex].id, suggestion);
    } else if (teamMembers.length < 5) {
      const newId = teamMembers.length > 0 ? Math.max(...teamMembers.map(t => t.id)) + 1 : 0;
      dispatch(setTeamMembers([...teamMembers, { id: newId, value: suggestion }]));
    }
    setShowSuggestions(false);
  };

  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 200);
  }, []);

  const getEmailStatus = (email: string, memberId: number) => {
    if (!email.trim()) return 'empty';
    if (!validatedEmails.has(memberId)) return 'empty';
    return validateEmail(email) ? 'valid' : 'invalid';
  };

  const handleBlur = (memberId: number, email: string) => {
    setFocusedIndex(null);
    if (email.trim()) setValidatedEmails(prev => new Set(prev).add(memberId));
  };

  const languages = [
    { key: 'en', label: t('languages.en'), flag: '🇺🇸' },
    { key: 'es', label: t('languages.es'), flag: '🇪🇸' },
    { key: 'pt', label: t('languages.pt'), flag: '🇵🇹' },
    { key: 'de', label: t('languages.de'), flag: '🇩🇪' },
    { key: 'alb', label: t('languages.alb'), flag: '🇦🇱' },
    { key: 'zh', label: t('languages.zh'), flag: '🇨🇳' },
  ];

  const handleLanguageChange = (languageKey: string) => {
    dispatch(setLanguage(languageKey));
    i18n.changeLanguage(languageKey);
  };

  const currentLanguage = languages.find(lang => lang.key === language) || languages[0];
  const languageMenuItems: MenuProps['items'] = languages.map(lang => ({
    key: lang.key,
    label: (
      <div className="flex items-center space-x-2">
        <span>{lang.flag}</span>
        <span>{lang.label}</span>
      </div>
    ),
    onClick: () => handleLanguageChange(lang.key),
  }));

  return (
    <div className="w-full members-step">
      {/* Header */}
      <div className="text-center mb-8">
        <Title level={3} className="mb-2" style={{ color: token?.colorText }}>
          {t('membersStepTitle')}
        </Title>
        <Paragraph className="text-base" style={{ color: token?.colorTextSecondary }}>
          {t('membersStepDescription', { organizationName })}
        </Paragraph>
      </div>

      {/* Team Members List */}
      <div className="mb-6">
        <div className="space-y-3">
          {teamMembers.map((teamMember, index) => {
            const emailStatus = getEmailStatus(teamMember.value, teamMember.id);
            return (
              <div
                key={teamMember.id}
                className={`flex items-center space-x-3 p-3 rounded-lg border transition-all duration-200 ${
                  focusedIndex === index ? 'border-2' : ''
                }`}
                style={{
                  borderColor:
                    focusedIndex === index
                      ? token?.colorPrimary
                      : emailStatus === 'invalid'
                        ? token?.colorError
                        : token?.colorBorder,
                  backgroundColor: token?.colorBgContainer,
                }}
              >
                <Avatar
                  size={32}
                  style={{
                    backgroundColor:
                      emailStatus === 'valid'
                        ? token?.colorSuccess
                        : emailStatus === 'invalid'
                          ? token?.colorError
                          : token?.colorBorderSecondary,
                    color: '#fff',
                  }}
                  icon={
                    emailStatus === 'valid' ? (
                      <CheckCircleOutlined />
                    ) : emailStatus === 'invalid' ? (
                      <ExclamationCircleOutlined />
                    ) : (
                      <UserOutlined />
                    )
                  }
                />

                <div className="flex-1">
                  <Input
                    placeholder={t('memberPlaceholder', { index: index + 1 })}
                    value={teamMember.value}
                    onChange={e => updateEmail(teamMember.id, e.target.value)}
                    onKeyPress={e => handleKeyPress(e, index)}
                    onFocus={() => setFocusedIndex(index)}
                    onBlur={() => handleBlur(teamMember.id, teamMember.value)}
                    ref={el => (inputRefs.current[index] = el)}
                    className="border-0 shadow-none"
                    style={{
                      backgroundColor: 'transparent',
                      color: token?.colorText,
                    }}
                    prefix={<MailOutlined style={{ color: token?.colorTextTertiary }} />}
                    status={emailStatus === 'invalid' ? 'error' : undefined}
                    suffix={
                      emailStatus === 'valid' ? (
                        <CheckCircleOutlined style={{ color: token?.colorSuccess }} />
                      ) : emailStatus === 'invalid' ? (
                        <ExclamationCircleOutlined style={{ color: token?.colorError }} />
                      ) : null
                    }
                  />
                  {emailStatus === 'invalid' && (
                    <Text type="danger" className="text-xs mt-1 block">
                      {t('invalidEmail')}
                    </Text>
                  )}
                  {emailStatus === 'valid' && (
                    <Text type="success" className="text-xs mt-1 block">
                      {t('validEmailAddress')}
                    </Text>
                  )}
                </div>

                {teamMembers.length > 1 && (
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseCircleOutlined />}
                    onClick={() => removeEmail(teamMember.id)}
                    style={{ color: token?.colorTextTertiary }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Add Member Button */}
        {teamMembers.length < 5 && (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={addEmail}
            className="w-full mt-4 h-12 text-base"
            style={{
              borderColor: token?.colorBorder,
              color: token?.colorTextSecondary,
            }}
          >
            {t('addAnotherTeamMember', { current: teamMembers.length, max: 5 })}
          </Button>
        )}
      </div>

      {/* Skip Option */}
      <div className="mb-6">
        <Alert
          message={t('canInviteLater')}
          description={t('skipStepDescription')}
          type="info"
          showIcon
          style={{
            backgroundColor: token?.colorInfoBg,
            borderColor: token?.colorInfoBorder,
          }}
        />
      </div>
    </div>
  );
};

export default MembersStep;
