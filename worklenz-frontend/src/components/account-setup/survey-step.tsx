import React from 'react';
import { Form, Input, Typography, Button, Progress, Space } from '@/shared/antd-imports';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { setSurveyData, setSurveySubStep } from '@/features/account-setup/account-setup.slice';
import { RootState } from '@/app/store';
import { 
  OrganizationType, 
  UserRole, 
  UseCase, 
  HowHeardAbout,
  IAccountSetupSurveyData 
} from '@/types/account-setup/survey.types';

const { Title, Paragraph } = Typography;
const { TextArea } = Input;

interface Props {
  onEnter: () => void;
  styles: any;
  isDarkMode: boolean;
  token?: any;
  isModal?: boolean; // New prop to indicate if used in modal context
}

interface SurveyPageProps {
  styles: any;
  isDarkMode: boolean;
  token?: any;
  surveyData: IAccountSetupSurveyData;
  handleSurveyDataChange: (field: keyof IAccountSetupSurveyData, value: any) => void;
  handleUseCaseToggle?: (value: UseCase) => void;
  isModal?: boolean;
}

// Page 1: About You
const AboutYouPage: React.FC<SurveyPageProps> = ({ styles, token, surveyData, handleSurveyDataChange }) => {
  const { t } = useTranslation('account-setup');
  
  const organizationTypeOptions: { value: OrganizationType; label: string; icon?: string }[] = [
    { value: 'freelancer', label: t('organizationTypeFreelancer'), icon: '👤' },
    { value: 'startup', label: t('organizationTypeStartup'), icon: '🚀' },
    { value: 'small_medium_business', label: t('organizationTypeSmallMediumBusiness'), icon: '🏢' },
    { value: 'agency', label: t('organizationTypeAgency'), icon: '🎯' },
    { value: 'enterprise', label: t('organizationTypeEnterprise'), icon: '🏛️' },
    { value: 'other', label: t('organizationTypeOther'), icon: '📋' },
  ];

  const userRoleOptions: { value: UserRole; label: string; icon?: string }[] = [
    { value: 'founder_ceo', label: t('userRoleFounderCeo'), icon: '👔' },
    { value: 'project_manager', label: t('userRoleProjectManager'), icon: '📊' },
    { value: 'software_developer', label: t('userRoleSoftwareDeveloper'), icon: '💻' },
    { value: 'designer', label: t('userRoleDesigner'), icon: '🎨' },
    { value: 'operations', label: t('userRoleOperations'), icon: '⚙️' },
    { value: 'other', label: t('userRoleOther'), icon: '✋' },
  ];

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <Title level={3} className="mb-2" style={{ color: token?.colorText }}>
          {t('aboutYouStepTitle')}
        </Title>
        <Paragraph className="text-base" style={{ color: token?.colorTextSecondary }}>
          {t('aboutYouStepDescription')}
        </Paragraph>
      </div>

      {/* Organization Type */}
      <Form.Item className="mb-8">
        <label className="block font-medium text-base mb-4" style={{ color: token?.colorText }}>
          {t('orgTypeQuestion')}
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          {organizationTypeOptions.map((option) => {
            const isSelected = surveyData.organization_type === option.value;
            return (
              <button
                key={option.value}
                onClick={() => handleSurveyDataChange('organization_type', option.value)}
                className={`p-2 rounded border transition-all duration-200 text-left hover:shadow-sm ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
                style={{
                  backgroundColor: isSelected ? undefined : token?.colorBgContainer,
                  borderColor: isSelected ? undefined : token?.colorBorder,
                }}
              >
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
                    {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                  <span className="text-base">{option.icon}</span>
                  <span 
                    className={`font-medium text-xs ${isSelected ? 'text-blue-600 dark:text-blue-400' : ''}`}
                    style={{ color: isSelected ? undefined : token?.colorText }}
                  >
                    {option.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </Form.Item>

      {/* User Role */}
      <Form.Item className="mb-4">
        <label className="block font-medium text-base mb-4" style={{ color: token?.colorText }}>
          {t('userRoleQuestion')}
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          {userRoleOptions.map((option) => {
            const isSelected = surveyData.user_role === option.value;
            return (
              <button
                key={option.value}
                onClick={() => handleSurveyDataChange('user_role', option.value)}
                className={`p-2 rounded border transition-all duration-200 text-left hover:shadow-sm ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
                style={{
                  backgroundColor: isSelected ? undefined : token?.colorBgContainer,
                  borderColor: isSelected ? undefined : token?.colorBorder,
                }}
              >
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
                    {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                  <span className="text-base">{option.icon}</span>
                  <span 
                    className={`font-medium text-xs ${isSelected ? 'text-blue-600 dark:text-blue-400' : ''}`}
                    style={{ color: isSelected ? undefined : token?.colorText }}
                  >
                    {option.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </Form.Item>
    </div>
  );
};

// Page 2: Your Needs
const YourNeedsPage: React.FC<SurveyPageProps> = ({ styles, token, surveyData, handleSurveyDataChange, handleUseCaseToggle }) => {
  const { t } = useTranslation('account-setup');
  
  const useCaseOptions: { value: UseCase; label: string; description: string }[] = [
    { value: 'task_management', label: t('mainUseCasesTaskManagement'), description: 'Organize and track tasks' },
    { value: 'team_collaboration', label: t('mainUseCasesTeamCollaboration'), description: 'Work together seamlessly' },
    { value: 'resource_planning', label: t('mainUseCasesResourcePlanning'), description: 'Manage time and resources' },
    { value: 'client_communication', label: t('mainUseCasesClientCommunication'), description: 'Stay connected with clients' },
    { value: 'time_tracking', label: t('mainUseCasesTimeTracking'), description: 'Monitor project hours' },
    { value: 'other', label: t('mainUseCasesOther'), description: 'Something else' },
  ];

  const onUseCaseClick = (value: UseCase) => {
    if (handleUseCaseToggle) {
      handleUseCaseToggle(value);
    } else {
      const currentUseCases = surveyData.main_use_cases || [];
      const isSelected = currentUseCases.includes(value);
      const newUseCases = isSelected ? currentUseCases.filter(useCase => useCase !== value) : [...currentUseCases, value];
      handleSurveyDataChange('main_use_cases', newUseCases);
    }
  };

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <Title level={3} className="mb-2" style={{ color: token?.colorText }}>
          {t('yourNeedsStepTitle')}
        </Title>
        <Paragraph className="text-base" style={{ color: token?.colorTextSecondary }}>
          {t('yourNeedsStepDescription')}
        </Paragraph>
      </div>

      {/* Main Use Cases */}
      <Form.Item className="mb-8">
        <label className="block font-medium text-base mb-4" style={{ color: token?.colorText }}>
          {t('yourNeedsQuestion')}
        </label>
        <div className="grid grid-cols-1 gap-1">
          {useCaseOptions.map((option) => {
            const isSelected = (surveyData.main_use_cases || []).includes(option.value);
            return (
              <button
                key={option.value}
                onClick={() => onUseCaseClick(option.value)}
                className={`p-2 rounded border transition-all duration-200 text-left hover:shadow-sm ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
                style={{
                  backgroundColor: isSelected ? undefined : token?.colorBgContainer,
                  borderColor: isSelected ? undefined : token?.colorBorder,
                }}
              >
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded border flex items-center justify-center ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
                    {isSelected && (
                      <svg width="10" height="10" fill="white" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <span className={`font-medium text-xs ${isSelected ? 'text-blue-600 dark:text-blue-400' : ''}`} style={{ color: isSelected ? undefined : token?.colorText }}>{option.label}</span>
                    <span className="text-xs ml-2" style={{ color: token?.colorTextSecondary }}>- {option.description}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {surveyData.main_use_cases && surveyData.main_use_cases.length > 0 && (
          <p className="mt-3 text-sm" style={{ color: token?.colorTextSecondary }}>
            {surveyData.main_use_cases.length} {t('selected')}
          </p>
        )}
      </Form.Item>

      {/* Previous Tools */}
      <Form.Item className="mb-4">
        <label className="block font-medium text-base mb-2" style={{ color: token?.colorText }}>
          {t('previousToolsLabel')}
        </label>
        <TextArea
          placeholder="e.g., Asana, Trello, Jira, Monday.com, etc."
          value={surveyData.previous_tools || ''}
          onChange={(e) => handleSurveyDataChange('previous_tools', e.target.value)}
          autoSize={{ minRows: 3, maxRows: 5 }}
          className="text-base"
          style={{ backgroundColor: token?.colorBgContainer, borderColor: token?.colorBorder, color: token?.colorText }}
        />
      </Form.Item>
    </div>
  );
};

// Page 3: Discovery
const DiscoveryPage: React.FC<SurveyPageProps> = ({ styles, token, surveyData, handleSurveyDataChange, isModal }) => {
  const { t } = useTranslation('account-setup');
  
  const howHeardAboutOptions: { value: HowHeardAbout; label: string; icon: string }[] = [
    { value: 'google_search', label: t('howHeardAboutGoogleSearch'), icon: '🔍' },
    { value: 'twitter', label: t('howHeardAboutTwitter'), icon: '🐦' },
    { value: 'linkedin', label: t('howHeardAboutLinkedin'), icon: '💼' },
    { value: 'friend_colleague', label: t('howHeardAboutFriendColleague'), icon: '👥' },
    { value: 'blog_article', label: t('howHeardAboutBlogArticle'), icon: '📰' },
    { value: 'other', label: t('howHeardAboutOther'), icon: '💡' },
  ];

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <Title level={3} className="mb-2" style={{ color: token?.colorText }}>
          {t('discoveryTitle')}
        </Title>
        <Paragraph className="text-base" style={{ color: token?.colorTextSecondary }}>
          {t('discoveryDescription')}
        </Paragraph>
      </div>

      {/* How Heard About */}
      <Form.Item className="mb-8">
        <label className="block font-medium text-base mb-4" style={{ color: token?.colorText }}>
          {t('discoveryQuestion')}
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          {howHeardAboutOptions.map((option) => {
            const isSelected = surveyData.how_heard_about === option.value;
            return (
              <button
                key={option.value}
                onClick={() => handleSurveyDataChange('how_heard_about', option.value)}
                className={`p-2 rounded border transition-all duration-200 hover:shadow-sm ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
                style={{
                  backgroundColor: isSelected ? undefined : token?.colorBgContainer,
                  borderColor: isSelected ? undefined : token?.colorBorder,
                }}
              >
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
                    {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                  <span className="text-base">{option.icon}</span>
                  <span className={`font-medium text-xs ${isSelected ? 'text-blue-600 dark:text-blue-400' : ''}`} style={{ color: isSelected ? undefined : token?.colorText }}>{option.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </Form.Item>

      <div className="mt-12 p-1.5 rounded-lg text-center" style={{ backgroundColor: token?.colorSuccessBg, borderColor: token?.colorSuccessBorder, border: '1px solid' }}>
        <div className="text-4xl mb-3">🎉</div>
        <Title level={4} style={{ color: token?.colorText, marginBottom: 8 }}>
          {isModal ? t('surveyCompleteTitle') : t('allSetTitle')}
        </Title>
        <Paragraph style={{ color: token?.colorTextSecondary, marginBottom: 0 }}>
          {isModal ? t('surveyCompleteDescription') : t('allSetDescription')}
        </Paragraph>
      </div>
    </div>
  );
};

export const SurveyStep: React.FC<Props> = ({ onEnter, styles, isDarkMode, token, isModal = false }) => {
  const { t } = useTranslation('account-setup');
  const dispatch = useDispatch();
  const { surveyData, surveySubStep } = useSelector((state: RootState) => state.accountSetupReducer);

  const handleSurveyDataChange = (field: keyof IAccountSetupSurveyData, value: any) => {
    dispatch(setSurveyData({ [field]: value }));
  };

  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const isValid = (surveySubStep === 0 && surveyData.organization_type && surveyData.user_role) || (surveySubStep === 1 && surveyData.main_use_cases && surveyData.main_use_cases.length > 0) || (surveySubStep === 2 && surveyData.how_heard_about);
        if (isValid && surveySubStep < 2) {
          dispatch(setSurveySubStep(surveySubStep + 1));
        } else if (isValid && surveySubStep === 2) {
          onEnter();
        }
      }
    };
    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [surveySubStep, surveyData, dispatch, onEnter]);

  const handleUseCaseToggle = (value: UseCase) => {
    const currentUseCases = surveyData.main_use_cases || [];
    const isSelected = currentUseCases.includes(value);
    const newUseCases = isSelected ? currentUseCases.filter(useCase => useCase !== value) : [...currentUseCases, value];
    handleSurveyDataChange('main_use_cases', newUseCases);
  };

  const getSubStepTitle = () => {
    switch (surveySubStep) {
      case 0: return t('aboutYouStepName');
      case 1: return t('yourNeedsStepName');
      case 2: return t('discoveryStepName');
      default: return '';
    }
  };

  const surveyPages = [
    <AboutYouPage key="about-you" styles={styles} isDarkMode={isDarkMode} token={token} surveyData={surveyData} handleSurveyDataChange={handleSurveyDataChange} isModal={isModal} />,
    <YourNeedsPage key="your-needs" styles={styles} isDarkMode={isDarkMode} token={token} surveyData={surveyData} handleSurveyDataChange={handleSurveyDataChange} handleUseCaseToggle={handleUseCaseToggle} isModal={isModal} />,
    <DiscoveryPage key="discovery" styles={styles} isDarkMode={isDarkMode} token={token} surveyData={surveyData} handleSurveyDataChange={handleSurveyDataChange} isModal={isModal} />
  ];

  React.useEffect(() => {
    dispatch(setSurveySubStep(0));
  }, []);

  return (
    <div className="w-full">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium" style={{ color: token?.colorTextSecondary }}>Step {surveySubStep + 1} of 3: {getSubStepTitle()}</span>
          <span className="text-sm" style={{ color: token?.colorTextSecondary }}>{Math.round(((surveySubStep + 1) / 3) * 100)}%</span>
        </div>
        <Progress percent={Math.round(((surveySubStep + 1) / 3) * 100)} showInfo={false} strokeColor={token?.colorPrimary} className="mb-0" />
      </div>

      {/* Current Page Content */}
      <div className="min-h-[400px] flex flex-col survey-page-transition" key={surveySubStep}>
        {surveyPages[surveySubStep]}
      </div>
    </div>
  );
};