import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Space, Steps, Button, Typography, theme, Dropdown, MenuProps } from '@/shared/antd-imports';
import { GlobalOutlined, MoonOutlined, SunOutlined } from '@/shared/antd-imports';

import logger from '@/utils/errorLogger';
import { setCurrentStep, setSurveySubStep } from '@/features/account-setup/account-setup.slice';
import { OrganizationStep } from '@/components/account-setup/organization-step';
import { ProjectStep } from '@/components/account-setup/project-step';
import { TasksStep } from '@/components/account-setup/tasks-step';
import { SurveyStep } from '@/components/account-setup/survey-step';
import MembersStep from '@/components/account-setup/members-step';
import {
  evt_account_setup_complete,
  evt_account_setup_skip_invite,
  evt_account_setup_visit,
} from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { verifyAuthentication } from '@/features/auth/authSlice';
import { setUser } from '@/features/user/userSlice';
import { IAuthorizeResponse } from '@/types/auth/login.types';
import { RootState } from '@/app/store';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { getUserSession, setSession } from '@/utils/session-helper';
import { validateEmail } from '@/utils/validateEmail';
import { sanitizeInput } from '@/utils/sanitizeInput';
import logo from '@/assets/images/worklenz-light-mode.png';
import logoDark from '@/assets/images/worklenz-dark-mode.png';
import { useAppDispatch } from '@/hooks/useAppDispatch';

import './account-setup.css';
import { IAccountSetupRequest } from '@/types/project-templates/project-templates.types';
import { profileSettingsApiService } from '@/api/settings/profile/profile-settings.api.service';
import { projectTemplatesApiService } from '@/api/project-templates/project-templates.api.service';
import { surveyApiService } from '@/api/survey/survey.api.service';
import { ISurveySubmissionRequest, ISurveyAnswer } from '@/types/account-setup/survey.types';
import { setLanguage } from '@/features/i18n/localesSlice';
import { ILanguageType, Language } from '@/features/i18n/localesSlice';
import { toggleTheme } from '@/features/theme/themeSlice';

const { Title } = Typography;

// Simplified styles for form components using Ant Design theme tokens
const getAccountSetupStyles = (token: any) => ({
  form: {
    width: '100%',
    maxWidth: '600px',
  },
  label: {
    color: token.colorText,
    fontWeight: 500,
  },
  buttonContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '1rem',
  },
  drawerFooter: {
    display: 'flex',
    justifyContent: 'right',
    padding: '10px 16px',
  },
});

const AccountSetup: React.FC = () => {
  const dispatch = useAppDispatch();
  const { t, i18n } = useTranslation('account-setup');
  useDocumentTitle(t('setupYourAccount', 'Account Setup'));
  const navigate = useNavigate();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { token } = theme.useToken();

  const { currentStep, organizationName, projectName, templateId, tasks, teamMembers, surveyData, surveySubStep } =
    useSelector((state: RootState) => state.accountSetupReducer);
  const lng = useSelector((state: RootState) => state.localesReducer.lng);
  const userDetails = getUserSession();
  const themeMode = useSelector((state: RootState) => state.themeReducer.mode);
  
  const [surveyId, setSurveyId] = React.useState<string | null>(null);
  const [isSkipping, setIsSkipping] = React.useState(false);

  const isDarkMode = themeMode === 'dark';
  // Helper to extract organization name from email or fallback to user name
  function getOrganizationNamePlaceholder(userDetails: { email?: string; name?: string } | null): string {
    if (!userDetails) return '';
    const email = userDetails.email || '';
    const name = userDetails.name || '';
    if (email) {
      const match = email.match(/^([^@]+)@([^@]+)$/);
      if (match) {
        const domain = match[2].toLowerCase();
        // List of common public email providers
        const publicProviders = [
          'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'protonmail.com', 'zoho.com', 'gmx.com', 'mail.com', 'yandex.com', 'msn.com', 'live.com', 'me.com', 'comcast.net', 'rediffmail.com', 'ymail.com', 'rocketmail.com', 'inbox.com', 'mail.ru', 'qq.com', 'naver.com', '163.com', '126.com', 'sina.com', 'yeah.net', 'googlemail.com', 'fastmail.com', 'hushmail.com', 'tutanota.com', 'pm.me', 'mailbox.org', 'proton.me'
        ];
        if (!publicProviders.includes(domain)) {
          // Use the first part of the domain (before the first dot)
          const org = domain.split('.')[0];
          if (org && org.length > 1) {
            return `e.g. ${org.charAt(0).toUpperCase() + org.slice(1)} Team`;
          }
        }
      }
    }
    // Fallback to user name
    return name ? `e.g. ${name}'s Team` : '';
  }

  const organizationNamePlaceholder = getOrganizationNamePlaceholder(userDetails);

  // Helper to extract organization name from email or fallback to user name
  function getOrganizationNameInitialValue(userDetails: { email?: string; name?: string } | null): string {
    if (!userDetails) return '';
    const email = userDetails.email || '';
    const name = userDetails.name || '';
    if (email) {
      const match = email.match(/^([^@]+)@([^@]+)$/);
      if (match) {
        const domain = match[2].toLowerCase();
        const publicProviders = [
          'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'protonmail.com', 'zoho.com', 'gmx.com', 'mail.com', 'yandex.com', 'msn.com', 'live.com', 'me.com', 'comcast.net', 'rediffmail.com', 'ymail.com', 'rocketmail.com', 'inbox.com', 'mail.ru', 'qq.com', 'naver.com', '163.com', '126.com', 'sina.com', 'yeah.net', 'googlemail.com', 'fastmail.com', 'hushmail.com', 'tutanota.com', 'pm.me', 'mailbox.org', 'proton.me'
        ];
        if (!publicProviders.includes(domain)) {
          const org = domain.split('.')[0];
          if (org && org.length > 1) {
            return org.charAt(0).toUpperCase() + org.slice(1);
          }
        }
      }
    }
    return name || '';
  }

  const organizationNameInitialValue = getOrganizationNameInitialValue(userDetails);

  const styles = getAccountSetupStyles(token);

  useEffect(() => {
    trackMixpanelEvent(evt_account_setup_visit);
    const verifyAuthStatus = async () => {
      try {
        const response = await dispatch(verifyAuthentication()).unwrap() as IAuthorizeResponse;
        if (response?.authenticated) {
          setSession(response.user);
          dispatch(setUser(response.user));
          if (response?.user?.setup_completed) {
            navigate('/worklenz/home');
          }
        }
      } catch (error) {
        logger.error('Failed to verify authentication status', error);
      }
    };
    
    const loadSurvey = async () => {
      try {
        const response = await surveyApiService.getAccountSetupSurvey();
        if (response.done && response.body) {
          setSurveyId(response.body.id);
        } else {
          logger.error('Survey not found or inactive (warn replaced with error)');
        }
      } catch (error) {
        logger.error('Failed to load survey', error);
        // Continue without survey - don't block account setup
      }
    };
    
    void verifyAuthStatus();
    void loadSurvey();
  }, [dispatch, navigate, trackMixpanelEvent]);


  const completeAccountSetup = async (skip = false) => {
    try {
      const model: IAccountSetupRequest = {
        team_name: sanitizeInput(organizationName),
        project_name: sanitizeInput(projectName),
        tasks: tasks.map(task => sanitizeInput(task.value.trim())).filter(task => task !== ''),
        team_members: skip
          ? []
          : teamMembers
              .map(teamMember => sanitizeInput(teamMember.value.trim()))
              .filter(email => validateEmail(email)),
        survey_data: {
          organization_type: surveyData.organization_type,
          user_role: surveyData.user_role,
          main_use_cases: surveyData.main_use_cases,
          previous_tools: surveyData.previous_tools,
          how_heard_about: surveyData.how_heard_about,
        },
      };
      const res = await profileSettingsApiService.setupAccount(model);
      if (res.done && res.body.id) {
        trackMixpanelEvent(skip ? evt_account_setup_skip_invite : evt_account_setup_complete);
        
        // Refresh user session to update setup_completed status
        try {
          const authResponse = await dispatch(verifyAuthentication()).unwrap() as IAuthorizeResponse;
          if (authResponse?.authenticated && authResponse?.user) {
            setSession(authResponse.user);
            dispatch(setUser(authResponse.user));
          }
        } catch (error) {
          logger.error('Failed to refresh user session after setup completion', error);
        }
        
        navigate(`/worklenz/projects/${res.body.id}?tab=tasks-list&pinned_tab=tasks-list`);
      }
    } catch (error) {
      logger.error('completeAccountSetup', error);
    }
  };

  const handleSkipMembers = async () => {
    try {
      setIsSkipping(true);
      // Bypass all validation and complete setup without team members
      await completeAccountSetup(true);
    } catch (error) {
      logger.error('Failed to skip members and complete setup', error);
    } finally {
      setIsSkipping(false);
    }
  };

  const completeAccountSetupWithTemplate = async () => {
    try {
      await saveSurveyData(); // Save survey data first
      
      const model: IAccountSetupRequest = {
        team_name: sanitizeInput(organizationName),
        project_name: null, // No project name when using template
        template_id: templateId,
        tasks: [],
        team_members: [],
        survey_data: {
          organization_type: surveyData.organization_type,
          user_role: surveyData.user_role,
          main_use_cases: surveyData.main_use_cases,
          previous_tools: surveyData.previous_tools,
          how_heard_about: surveyData.how_heard_about,
        },
      };
      
      const res = await projectTemplatesApiService.setupAccount(model);
      if (res.done && res.body.id) {
        trackMixpanelEvent(evt_account_setup_complete);
        
        // Refresh user session to update setup_completed status
        try {
          const authResponse = await dispatch(verifyAuthentication()).unwrap() as IAuthorizeResponse;
          if (authResponse?.authenticated && authResponse?.user) {
            setSession(authResponse.user);
            dispatch(setUser(authResponse.user));
          }
        } catch (error) {
          logger.error('Failed to refresh user session after template setup completion', error);
        }
        
        navigate(`/worklenz/projects/${res.body.id}?tab=tasks-list&pinned_tab=tasks-list`);
      }
    } catch (error) {
      logger.error('completeAccountSetupWithTemplate', error);
    }
  };

  const steps = [
    {
      title: '',
      content: (
        <OrganizationStep
          onEnter={() => dispatch(setCurrentStep(currentStep + 1))}
          styles={styles}
          organizationNamePlaceholder={organizationNamePlaceholder}
          organizationNameInitialValue={organizationNameInitialValue}
          isDarkMode={isDarkMode}
          token={token}
        />
      ),
    },
    {
      title: '',
      content: (
        <SurveyStep
          onEnter={() => dispatch(setCurrentStep(currentStep + 1))}
          styles={styles}
          isDarkMode={isDarkMode}
          token={token}
        />
      ),
    },
    {
      title: '',
      content: (
        <ProjectStep
          onEnter={() => dispatch(setCurrentStep(currentStep + 1))}
          styles={styles}
          isDarkMode={isDarkMode}
          token={token}
        />
      ),
    },
    {
      title: '',
      content: (
        <TasksStep
          onEnter={() => dispatch(setCurrentStep(currentStep + 1))}
          styles={styles}
          isDarkMode={isDarkMode}
          token={token}
        />
      ),
    },
    {
      title: '',
      content: <MembersStep isDarkMode={isDarkMode} styles={styles} token={token} />,
    },
  ];

  const isContinueDisabled = () => {
    switch (currentStep) {
      case 0:
        return !organizationName?.trim();
      case 1:
        // Survey step - check current sub-step requirements
        if (surveySubStep === 0) {
          return !(surveyData.organization_type && surveyData.user_role);
        } else if (surveySubStep === 1) {
          return !(surveyData.main_use_cases && surveyData.main_use_cases.length > 0);
        } else if (surveySubStep === 2) {
          return !surveyData.how_heard_about;
        }
        return false;
      case 2:
        // Project step - either project name OR template must be provided
        return !projectName?.trim() && !templateId;
      case 3:
        return tasks.length === 0 || tasks.every(task => !task.value?.trim());
      case 4:
        return (
          teamMembers.length > 0 && !teamMembers.some(member => validateEmail(member.value?.trim()))
        );
      default:
        return true;
    }
  };

  const saveSurveyData = async () => {
    if (!surveyId || !surveyData) {
      logger.error('Skipping survey save - no survey ID or data (info replaced with error)');
      return;
    }

    try {
      const answers: ISurveyAnswer[] = [];
      
      // Get the survey questions to map data properly
      const surveyResponse = await surveyApiService.getAccountSetupSurvey();
      if (!surveyResponse.done || !surveyResponse.body?.questions) {
        logger.error('Could not retrieve survey questions for data mapping (warn replaced with error)');
        return;
      }

      const questions = surveyResponse.body.questions;

      // Map survey data to answers based on question keys
      questions.forEach(question => {
        switch (question.question_key) {
          case 'organization_type':
            if (surveyData.organization_type) {
              answers.push({
                question_id: question.id,
                answer_text: surveyData.organization_type
              });
            }
            break;
          case 'user_role':
            if (surveyData.user_role) {
              answers.push({
                question_id: question.id,
                answer_text: surveyData.user_role
              });
            }
            break;
          case 'main_use_cases':
            if (surveyData.main_use_cases && surveyData.main_use_cases.length > 0) {
              answers.push({
                question_id: question.id,
                answer_json: surveyData.main_use_cases
              });
            }
            break;
          case 'previous_tools':
            if (surveyData.previous_tools) {
              answers.push({
                question_id: question.id,
                answer_text: surveyData.previous_tools
              });
            }
            break;
          case 'how_heard_about':
            if (surveyData.how_heard_about) {
              answers.push({
                question_id: question.id,
                answer_text: surveyData.how_heard_about
              });
            }
            break;
        }
      });

      if (answers.length > 0) {
        const submissionData: ISurveySubmissionRequest = {
          survey_id: surveyId,
          answers
        };
        
        const result = await surveyApiService.submitSurveyResponse(submissionData);
        if (result.done) {
          logger.error('Survey data saved successfully (info replaced with error)');
        } else {
          logger.error('Survey submission returned unsuccessful response (warn replaced with error)');
        }
      } else {
        logger.error('No survey answers to save (info replaced with error)');
      }
    } catch (error) {
      logger.error('Failed to save survey data', error);
      // Don't block account setup flow if survey fails
    }
  };

  const nextStep = async () => {
    if (currentStep === 1) {
      // Handle survey sub-step navigation
      if (surveySubStep < 2) {
        // Move to next survey sub-step
        dispatch(setSurveySubStep(surveySubStep + 1));
      } else {
        // Survey completed, save data and move to next main step
        await saveSurveyData();
        dispatch(setCurrentStep(currentStep + 1));
        dispatch(setSurveySubStep(0)); // Reset for next time
      }
    } else if (currentStep === 2) {
      // Project step - check if template is selected
      if (templateId) {
        // Template selected, complete account setup with template
        await completeAccountSetupWithTemplate();
      } else {
        // No template, proceed to tasks step
        dispatch(setCurrentStep(currentStep + 1));
      }
    } else if (currentStep === 4) {
      // Complete setup after members step
      completeAccountSetup();
    } else {
      dispatch(setCurrentStep(currentStep + 1));
    }
  };

  // Language switcher functionality
  const languages = [
    { key: Language.EN, label: 'English', flag: '🇺🇸' },
    { key: Language.ES, label: 'Español', flag: '🇪🇸' },
    { key: Language.PT, label: 'Português', flag: '🇵🇹' },
    { key: Language.DE, label: 'Deutsch', flag: '🇩🇪' },
    { key: Language.ALB, label: 'Shqip', flag: '🇦🇱' },
    { key: Language.ZH_CN, label: '简体中文', flag: '🇨🇳' }
  ];

  const handleLanguageChange = (languageKey: ILanguageType) => {
    dispatch(setLanguage(languageKey));
    i18n.changeLanguage(languageKey);
  };

  const handleThemeToggle = () => {
    dispatch(toggleTheme());
  };

  const languageMenuItems: MenuProps['items'] = languages.map(lang => ({
    key: lang.key,
    label: (
      <div className="flex items-center space-x-2">
        <span>{lang.flag}</span>
        <span>{lang.label}</span>
      </div>
    ),
    onClick: () => handleLanguageChange(lang.key as ILanguageType)
  }));

  const currentLanguage = languages.find(lang => lang.key === lng) || languages[0];

  return (
    <div 
      className="account-setup-container min-h-screen w-full flex flex-col items-center py-8 px-4 relative"
      style={{ backgroundColor: token.colorBgLayout }}
    >
      {/* Controls - Top Right */}
      <div className="absolute top-6 right-6 flex items-center space-x-3">
        {/* Theme Switcher */}
        <Button
          type="text"
          size="small"
          icon={isDarkMode ? <SunOutlined /> : <MoonOutlined />}
          onClick={handleThemeToggle}
          className="flex items-center"
          style={{ color: token?.colorTextTertiary }}
          title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        />
        
        {/* Language Switcher */}
        <Dropdown
          menu={{ items: languageMenuItems }}
          placement="bottomRight"
          trigger={['click']}
        >
          <Button
            type="text"
            size="small"
            icon={<GlobalOutlined />}
            className="flex items-center space-x-2"
            style={{ color: token?.colorTextTertiary }}
          >
            <span>{currentLanguage.flag}</span>
            <span>{currentLanguage.label}</span>
          </Button>
        </Dropdown>
      </div>

      {/* Logo */}
      <div className="mb-4">
        <img src={isDarkMode ? logoDark : logo} alt="Logo" width={235} height={50} />
      </div>
      
      {/* Title */}
      <Title 
        level={3} 
        className="text-center mb-6 font-semibold"
        style={{ color: token.colorText }}
      >
        {t('setupYourAccount')}
      </Title>
      
      {/* Content Container */}
      <div 
        className="w-full max-w-4xl rounded-lg shadow-lg mt-6 p-8"
        style={{
          backgroundColor: token.colorBgContainer,
          borderColor: token.colorBorder,
          border: `1px solid ${token.colorBorder}`,
          boxShadow: token.boxShadowTertiary
        }}
      >
        <div className="flex flex-col items-center space-y-6 w-full">
          {/* Steps */}
          <div className="w-full max-w-2xl">
            <Steps
              className={`${isContinueDisabled() ? 'step' : 'progress-steps'} ${isDarkMode ? 'dark-mode' : 'light-mode'}`}
              current={currentStep}
              items={steps}
            />
          </div>
          
          {/* Step Content */}
          <div className="w-full max-w-2xl flex flex-col items-center min-h-fit">
            <div className="step-content w-full">
              {steps[currentStep].content}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="w-full max-w-2xl mt-8">
            <div className={`flex ${
              currentStep !== 0 ? 'justify-between' : 'justify-end'
            } items-center`}>
              {currentStep !== 0 && (
                <div className="flex flex-col space-y-2">
                  <Button
                    type="link"
                    className="p-0 font-medium"
                    style={{ color: token.colorTextSecondary }}
                    onClick={() => {
                      if (currentStep === 1 && surveySubStep > 0) {
                        // Go back within survey sub-steps
                        dispatch(setSurveySubStep(surveySubStep - 1));
                      } else {
                        // Go back to previous main step
                        dispatch(setCurrentStep(currentStep - 1));
                        if (currentStep === 2) {
                          // When going back to survey from next step, go to last sub-step
                          dispatch(setSurveySubStep(2));
                        }
                      }
                    }}
                  >
                    {t('goBack')}
                  </Button>
                  {currentStep === 4 && (
                    <Button
                      type="link"
                      className="p-0 font-medium"
                      style={{ color: token.colorTextTertiary }}
                      onClick={handleSkipMembers}
                      loading={isSkipping}
                      disabled={isSkipping}
                    >
                      {isSkipping ? t('skipping') : t('skipForNow')}
                    </Button>
                  )}
                </div>
              )}
              <Button
                type="primary"
                htmlType="submit"
                disabled={isContinueDisabled()}
                onClick={nextStep}
              >
                {t('continue')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountSetup;
