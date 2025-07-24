import React from 'react';
import { Form, Input, Typography, Button } from '@/shared/antd-imports';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { setSurveyData } from '@/features/account-setup/account-setup.slice';
import { RootState } from '@/app/store';
import { 
  OrganizationType, 
  UserRole, 
  UseCase, 
  HowHeardAbout,
  IAccountSetupSurveyData 
} from '@/types/account-setup/survey.types';

const { Title } = Typography;
const { TextArea } = Input;

interface Props {
  onEnter: () => void;
  styles: any;
  isDarkMode: boolean;
  token?: any;
}

export const SurveyStep: React.FC<Props> = ({ onEnter, styles, isDarkMode, token }) => {
  const { t } = useTranslation('account-setup');
  const dispatch = useDispatch();
  const { surveyData } = useSelector((state: RootState) => state.accountSetupReducer);

  const handleSurveyDataChange = (field: keyof IAccountSetupSurveyData, value: any) => {
    dispatch(setSurveyData({ [field]: value }));
  };

  // Get Ant Design button type based on selection state
  const getButtonType = (isSelected: boolean) => {
    return isSelected ? 'primary' : 'default';
  };

  // Handle multi-select for use cases (button-based)
  const handleUseCaseToggle = (value: UseCase) => {
    const currentUseCases = surveyData.main_use_cases || [];
    const isSelected = currentUseCases.includes(value);
    
    let newUseCases;
    if (isSelected) {
      // Remove if already selected
      newUseCases = currentUseCases.filter(useCase => useCase !== value);
    } else {
      // Add if not selected
      newUseCases = [...currentUseCases, value];
    }
    
    handleSurveyDataChange('main_use_cases', newUseCases);
  };

  const onPressEnter = () => {
    onEnter();
  };

  const organizationTypeOptions: { value: OrganizationType; label: string }[] = [
    { value: 'freelancer', label: t('organizationTypeFreelancer') },
    { value: 'startup', label: t('organizationTypeStartup') },
    { value: 'small_medium_business', label: t('organizationTypeSmallMediumBusiness') },
    { value: 'agency', label: t('organizationTypeAgency') },
    { value: 'enterprise', label: t('organizationTypeEnterprise') },
    { value: 'other', label: t('organizationTypeOther') },
  ];

  const userRoleOptions: { value: UserRole; label: string }[] = [
    { value: 'founder_ceo', label: t('userRoleFounderCeo') },
    { value: 'project_manager', label: t('userRoleProjectManager') },
    { value: 'software_developer', label: t('userRoleSoftwareDeveloper') },
    { value: 'designer', label: t('userRoleDesigner') },
    { value: 'operations', label: t('userRoleOperations') },
    { value: 'other', label: t('userRoleOther') },
  ];

  const useCaseOptions: { value: UseCase; label: string }[] = [
    { value: 'task_management', label: t('mainUseCasesTaskManagement') },
    { value: 'team_collaboration', label: t('mainUseCasesTeamCollaboration') },
    { value: 'resource_planning', label: t('mainUseCasesResourcePlanning') },
    { value: 'client_communication', label: t('mainUseCasesClientCommunication') },
    { value: 'time_tracking', label: t('mainUseCasesTimeTracking') },
    { value: 'other', label: t('mainUseCasesOther') },
  ];

  const howHeardAboutOptions: { value: HowHeardAbout; label: string }[] = [
    { value: 'google_search', label: t('howHeardAboutGoogleSearch') },
    { value: 'twitter', label: t('howHeardAboutTwitter') },
    { value: 'linkedin', label: t('howHeardAboutLinkedin') },
    { value: 'friend_colleague', label: t('howHeardAboutFriendColleague') },
    { value: 'blog_article', label: t('howHeardAboutBlogArticle') },
    { value: 'other', label: t('howHeardAboutOther') },
  ];

  return (
    <Form className="step-form" style={styles.form}>
      <Form.Item className="mb-6">
        <Title level={2} className="mb-2 text-2xl" style={{ color: token?.colorText }}>
          {t('surveyStepTitle')}
        </Title>
        <p className="mb-4 text-sm" style={{ color: token?.colorTextSecondary }}>
          {t('surveyStepLabel')}
        </p>
      </Form.Item>

      {/* Organization Type */}
      <Form.Item
        label={<span className="font-medium text-sm" style={{ color: token?.colorText }}>{t('organizationType')}</span>}
        className="mb-6"
      >
        <div className="mt-3 flex flex-wrap gap-2">
          {organizationTypeOptions.map((option) => (
            <Button
              key={option.value}
              onClick={() => handleSurveyDataChange('organization_type', option.value)}
              type={getButtonType(surveyData.organization_type === option.value)}
              size="small"
              className="h-8"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </Form.Item>

      {/* User Role */}
      <Form.Item
        label={<span className="font-medium text-sm" style={{ color: token?.colorText }}>{t('userRole')}</span>}
        className="mb-6"
      >
        <div className="mt-3 flex flex-wrap gap-2">
          {userRoleOptions.map((option) => (
            <Button
              key={option.value}
              onClick={() => handleSurveyDataChange('user_role', option.value)}
              type={getButtonType(surveyData.user_role === option.value)}
              size="small"
              className="h-8"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </Form.Item>

      {/* Main Use Cases */}
      <Form.Item
        label={<span className="font-medium text-sm" style={{ color: token?.colorText }}>{t('mainUseCases')}</span>}
        className="mb-6"
      >
        <div className="mt-3 flex flex-wrap gap-2">
          {useCaseOptions.map((option) => {
            const isSelected = (surveyData.main_use_cases || []).includes(option.value);
            return (
              <Button
                key={option.value}
                onClick={() => handleUseCaseToggle(option.value)}
                type={getButtonType(isSelected)}
                size="small"
                className="h-8"
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      </Form.Item>

      {/* Previous Tools */}
      <Form.Item
        label={<span className="font-medium text-sm" style={{ color: token?.colorText }}>{t('previousTools')}</span>}
        className="mb-6"
      >
        <TextArea
          placeholder={t('previousToolsPlaceholder')}
          value={surveyData.previous_tools || ''}
          onChange={(e) => handleSurveyDataChange('previous_tools', e.target.value)}
          autoSize={{ minRows: 2, maxRows: 3 }}
          className="mt-2 text-sm"
          style={{
            backgroundColor: token?.colorBgContainer,
            borderColor: token?.colorBorder,
            color: token?.colorText
          }}
        />
      </Form.Item>

      {/* How Heard About */}
      <Form.Item
        label={<span className="font-medium text-sm" style={{ color: token?.colorText }}>{t('howHeardAbout')}</span>}
        className="mb-2"
      >
        <div className="mt-3 flex flex-wrap gap-2">
          {howHeardAboutOptions.map((option) => (
            <Button
              key={option.value}
              onClick={() => handleSurveyDataChange('how_heard_about', option.value)}
              type={getButtonType(surveyData.how_heard_about === option.value)}
              size="small"
              className="h-8"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </Form.Item>
    </Form>
  );
};