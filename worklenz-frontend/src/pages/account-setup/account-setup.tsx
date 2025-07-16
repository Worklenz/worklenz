import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Space, Steps, Button, Typography } from 'antd/es';

import logger from '@/utils/errorLogger';
import { setCurrentStep } from '@/features/account-setup/account-setup.slice';
import { OrganizationStep } from '@/components/account-setup/organization-step';
import { ProjectStep } from '@/components/account-setup/project-step';
import { TasksStep } from '@/components/account-setup/tasks-step';
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

const { Title } = Typography;

const AccountSetup: React.FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('account-setup');
  useDocumentTitle(t('setupYourAccount', 'Account Setup'));
  const navigate = useNavigate();
  const { trackMixpanelEvent } = useMixpanelTracking();

  const { currentStep, organizationName, projectName, templateId, tasks, teamMembers } =
    useSelector((state: RootState) => state.accountSetupReducer);
  const userDetails = getUserSession();
  const themeMode = useSelector((state: RootState) => state.themeReducer.mode);

  const isDarkMode = themeMode === 'dark';
  const organizationNamePlaceholder = userDetails?.name ? `e.g. ${userDetails?.name}'s Team` : '';

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
    void verifyAuthStatus();
  }, [dispatch, navigate, trackMixpanelEvent]);

  const calculateHeight = () => {
    if (currentStep === 2) {
      return tasks.length * 105;
    }

    if (currentStep === 3) {
      return teamMembers.length * 105;
    }
    return 'min-content';
  };

  const styles = {
    form: {
      width: '600px',
      paddingBottom: '1rem',
      marginTop: '3rem',
      height: '100%',
      overflow: 'hidden',
    },
    label: {
      color: isDarkMode ? '' : '#00000073',
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
    container: {
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      padding: '3rem 0',
      backgroundColor: isDarkMode ? 'black' : '#FAFAFA',
    },
    contentContainer: {
      backgroundColor: isDarkMode ? '#141414' : 'white',
      marginTop: '1.5rem',
      paddingTop: '3rem',
      margin: '1.5rem auto 0',
      width: '100%',
      maxWidth: '66.66667%',
      minHeight: 'fit-content',
      display: 'flex',
      flexDirection: 'column' as const,
    },
    space: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      gap: '0',
      flexGrow: 1,
      width: '100%',
      minHeight: 'fit-content',
    },
    steps: {
      margin: '1rem 0',
      width: '600px',
    },
    stepContent: {
      flexGrow: 1,
      width: '600px',
      minHeight: calculateHeight(),
      overflow: 'visible',
    },
    actionButtons: {
      flexGrow: 1,
      width: '600px',
      marginBottom: '1rem',
    },
  };

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

  const steps = [
    {
      title: '',
      content: (
        <OrganizationStep
          onEnter={() => dispatch(setCurrentStep(currentStep + 1))}
          styles={styles}
          organizationNamePlaceholder={organizationNamePlaceholder}
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
        />
      ),
    },
    {
      title: '',
      content: <MembersStep isDarkMode={isDarkMode} styles={styles} />,
    },
  ];

  const isContinueDisabled = () => {
    switch (currentStep) {
      case 0:
        return !organizationName?.trim();
      case 1:
        return !projectName?.trim() && !templateId;
      case 2:
        return tasks.length === 0 || tasks.every(task => !task.value?.trim());
      case 3:
        return (
          teamMembers.length > 0 && !teamMembers.some(member => validateEmail(member.value?.trim()))
        );
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (currentStep === 3) {
      completeAccountSetup();
    } else {
      dispatch(setCurrentStep(currentStep + 1));
    }
  };

  return (
    <div style={styles.container}>
      <div>
        <img src={isDarkMode ? logoDark : logo} alt="Logo" width={235} height={50} />
      </div>
      <Title level={5} style={{ textAlign: 'center', margin: '4px 0 24px' }}>
        {t('setupYourAccount')}
      </Title>
      <div style={styles.contentContainer}>
        <Space className={isDarkMode ? 'dark-mode' : ''} style={styles.space} direction="vertical">
          <Steps
            className={isContinueDisabled() ? 'step' : 'progress-steps'}
            current={currentStep}
            items={steps}
            style={styles.steps}
          />
          <div className="step-content" style={styles.stepContent}>
            {steps[currentStep].content}
          </div>
          <div style={styles.actionButtons} className="setup-action-buttons">
            <div
              style={{
                display: 'flex',
                justifyContent: currentStep !== 0 ? 'space-between' : 'flex-end',
              }}
            >
              {currentStep !== 0 && (
                <div>
                  <Button
                    style={{ padding: 0 }}
                    type="link"
                    className="my-7"
                    onClick={() => dispatch(setCurrentStep(currentStep - 1))}
                  >
                    {t('goBack')}
                  </Button>
                  {currentStep === 3 && (
                    <Button
                      style={{ color: isDarkMode ? '' : '#00000073', fontWeight: 500 }}
                      type="link"
                      className="my-7"
                      onClick={() => completeAccountSetup(true)}
                    >
                      {t('skipForNow')}
                    </Button>
                  )}
                </div>
              )}
              <Button
                type="primary"
                htmlType="submit"
                disabled={isContinueDisabled()}
                className="mt-7 mb-7"
                onClick={nextStep}
              >
                {t('continue')}
              </Button>
            </div>
          </div>
        </Space>
      </div>
    </div>
  );
};

export default AccountSetup;
