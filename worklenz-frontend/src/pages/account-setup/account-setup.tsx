import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Typography, theme, Dropdown, MenuProps, Popover, Divider, Flex } from '@/shared/antd-imports';
import { GlobalOutlined, MoonOutlined, SunOutlined, UserSwitchOutlined } from '@/shared/antd-imports';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';

import logger from '@/utils/errorLogger';
import { invitationRedirectService } from '@/services/invitation-redirect.service';
import { setCurrentStep } from '@/features/account-setup/account-setup.slice';
import { OrganizationStep } from '@/components/account-setup/organization-step';
import { ProjectStep } from '@/components/account-setup/project-step';
import MembersStep from '@/components/account-setup/members-step';
import {
  evt_account_setup_visit,
  evt_account_setup_complete,
  evt_account_setup_skip_invite,
  evt_signup_completed,
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
import { timezonesApiService } from '@/api/settings/language-timezones/language-timezones-api.service';
import { setLanguage } from '@/features/i18n/localesSlice';
import { ILanguageType, Language } from '@/features/i18n/localesSlice';
import { toggleTheme } from '@/features/theme/themeSlice';
import { AUTH_PRIMARY_BUTTON_COLOR } from '@/shared/constants';
import alertService from '@/services/alerts/alertService';

const PUBLIC_EMAIL_PROVIDERS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
  'aol.com', 'protonmail.com', 'zoho.com', 'gmx.com', 'mail.com',
  'yandex.com', 'msn.com', 'live.com', 'me.com', 'comcast.net',
  'rediffmail.com', 'ymail.com', 'rocketmail.com', 'inbox.com', 'mail.ru',
  'qq.com', 'naver.com', '163.com', '126.com', 'sina.com', 'yeah.net',
  'googlemail.com', 'fastmail.com', 'hushmail.com', 'tutanota.com',
  'pm.me', 'mailbox.org', 'proton.me',
];

const getAccountSetupStyles = (token: any) => ({
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

  const { currentStep, organizationName, projectName, templateId, teamMembers } = useSelector(
    (state: RootState) => state.accountSetupReducer
  );
  const lng = useSelector((state: RootState) => state.localesReducer.lng);
  const userDetails = getUserSession();
  const themeMode = useSelector((state: RootState) => state.themeReducer.mode);

  const [isSkipping, setIsSkipping] = React.useState(false);

  // Single loading flag guards ALL async nextStep paths, preventing double-clicks
  // on Continue from firing completeAccountSetupWithTemplate()/completeAccountSetup() twice.
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const isDarkMode = themeMode === 'dark';

  function getOrganizationNamePlaceholder(
    userDetails: { email?: string; name?: string } | null
  ): string {
    if (!userDetails) return '';
    const email = userDetails.email || '';
    const name = userDetails.name || '';
    if (email) {
      const match = email.match(/^([^@]+)@([^@]+)$/);
      if (match) {
        const domain = match[2].toLowerCase();
        if (!PUBLIC_EMAIL_PROVIDERS.includes(domain)) {
          const org = domain.split('.')[0];
          if (org && org.length > 1) {
            return t('organizationNamePlaceholderFromDomain', {
              org: org.charAt(0).toUpperCase() + org.slice(1),
              defaultValue: 'e.g. {{org}} Team',
            });
          }
        }
      }
    }
    return name
      ? t('organizationNamePlaceholderFromName', { name, defaultValue: "e.g. {{name}}'s Team" })
      : '';
  }

  function getOrganizationNameInitialValue(
    userDetails: { email?: string; name?: string } | null
  ): string {
    if (!userDetails) return '';
    const email = userDetails.email || '';
    const name = userDetails.name || '';
    if (email) {
      const match = email.match(/^([^@]+)@([^@]+)$/);
      if (match) {
        const domain = match[2].toLowerCase();
        if (!PUBLIC_EMAIL_PROVIDERS.includes(domain)) {
          const org = domain.split('.')[0];
          if (org && org.length > 1) {
            return org.charAt(0).toUpperCase() + org.slice(1);
          }
        }
      }
    }
    return name || '';
  }

  const organizationNamePlaceholder = getOrganizationNamePlaceholder(userDetails);
  const organizationNameInitialValue = getOrganizationNameInitialValue(userDetails);
  const styles = getAccountSetupStyles(token);

  useEffect(() => {
    trackMixpanelEvent(evt_account_setup_visit);
    const verifyAuthStatus = async () => {
      try {
        const response = (await dispatch(verifyAuthentication()).unwrap()) as IAuthorizeResponse;
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

  const completeAccountSetup = async (skip = false) => {
    try {
      const model: IAccountSetupRequest = {
        team_name: sanitizeInput(organizationName),
        project_name: sanitizeInput(projectName),
        tasks: [],
        team_members: skip
          ? []
          : teamMembers
              .map(teamMember => sanitizeInput(teamMember.value.trim()))
              .filter(email => validateEmail(email)),
      };
      const res = await profileSettingsApiService.setupAccount(model);
      if (res.done && res.body.id) {
        trackMixpanelEvent(skip ? evt_account_setup_skip_invite : evt_account_setup_complete);

        const currentUser = getUserSession();
        trackMixpanelEvent(evt_signup_completed, {
          plan_type: currentUser?.subscription_type?.toLowerCase() || 'free',
          signup_method: 'email',
          template_used: false,
        });

        try {
          const authResponse = (await dispatch(
            verifyAuthentication()
          ).unwrap()) as IAuthorizeResponse;
          if (authResponse?.authenticated && authResponse?.user) {
            setSession(authResponse.user);
            dispatch(setUser(authResponse.user));
          }
        } catch (error) {
          logger.error('Failed to refresh user session after setup completion', error);
        }

        const pendingInvitation = invitationRedirectService.getPendingInvitation();
        if (pendingInvitation) {
          navigate(pendingInvitation.url);
          return;
        }

        navigate(`/worklenz/projects/${res.body.id}?tab=tasks-list&pinned_tab=tasks-list`);
      } else {
        alertService.error(
          res.title || t('setupFailedTitle', 'Setup failed'),
          res.message || t('setupFailedMessage', 'Something went wrong while setting up your account. Please try again.')
        );
      }
    } catch (error) {
      logger.error('completeAccountSetup', error);
      alertService.error(
        t('setupFailedTitle', 'Setup failed'),
        t('setupFailedMessage', 'Something went wrong while setting up your account. Please try again.')
      );
    }
  };

  const handleSkipMembers = async () => {
    try {
      setIsSkipping(true);
      await completeAccountSetup(true);
    } catch (error) {
      logger.error('Failed to skip members and complete setup', error);
    } finally {
      setIsSkipping(false);
    }
  };

  const completeAccountSetupWithTemplate = async () => {
    try {
      const model: IAccountSetupRequest = {
        team_name: sanitizeInput(organizationName),
        project_name: null,
        template_id: templateId,
        tasks: [],
        team_members: [],
      };

      const res = await projectTemplatesApiService.setupAccount(model);
      if (res.done && res.body.id) {
        trackMixpanelEvent(evt_account_setup_complete);

        const currentUser = getUserSession();
        trackMixpanelEvent(evt_signup_completed, {
          plan_type: currentUser?.subscription_type?.toLowerCase() || 'free',
          signup_method: 'email',
          template_used: true,
        });

        try {
          const authResponse = (await dispatch(
            verifyAuthentication()
          ).unwrap()) as IAuthorizeResponse;
          if (authResponse?.authenticated && authResponse?.user) {
            setSession(authResponse.user);
            dispatch(setUser(authResponse.user));
          }
        } catch (error) {
          logger.error('Failed to refresh user session after template setup completion', error);
        }

        const pendingInvitation = invitationRedirectService.getPendingInvitation();
        if (pendingInvitation) {
          navigate(pendingInvitation.url);
          return;
        }

        navigate(`/worklenz/projects/${res.body.id}?tab=tasks-list&pinned_tab=tasks-list`);
      } else {
        alertService.error(
          res.title || t('setupFailedTitle', 'Setup failed'),
          res.message || t('setupFailedMessage', 'Something went wrong while setting up your account. Please try again.')
        );
      }
    } catch (error) {
      logger.error('completeAccountSetupWithTemplate', error);
      alertService.error(
        t('setupFailedTitle', 'Setup failed'),
        t('setupFailedMessage', 'Something went wrong while setting up your account. Please try again.')
      );
    }
  };

  const STEP_LABELS = [t('stepOrganization'), t('stepProject'), t('stepInviteTeam')];

  const stepContent = [
    <OrganizationStep
      key="organization"
      onEnter={() => dispatch(setCurrentStep(currentStep + 1))}
      organizationNamePlaceholder={organizationNamePlaceholder}
      organizationNameInitialValue={organizationNameInitialValue}
      prefilledEmail={userDetails?.email}
      isDarkMode={isDarkMode}
      token={token}
    />,
    // ProjectStep.onEnter goes straight to nextStep (not a plain setCurrentStep
    // dispatch): picking a template must finalize setup here, and this is the
    // single point that calls completeAccountSetupWithTemplate() so a project is
    // never created twice.
    <ProjectStep key="project" onEnter={nextStep} styles={styles} isDarkMode={isDarkMode} token={token} />,
    <MembersStep key="members" isDarkMode={isDarkMode} styles={styles} token={token} />,
  ];

  const isContinueDisabled = () => {
    if (isSubmitting) return true;

    switch (currentStep) {
      case 0:
        return (organizationName?.trim() ?? '').length < 2;
      case 1:
        return !projectName?.trim() && !templateId;
      case 2:
        return (
          teamMembers.length > 0 && !teamMembers.some(member => validateEmail(member.value?.trim()))
        );
      default:
        return true;
    }
  };

  // Single point of control for all step transitions. isSubmitting guards
  // against double-clicks by returning early if already in flight.
  async function nextStep() {
    if (isSubmitting) return;

    if (currentStep === 1) {
      if (templateId) {
        setIsSubmitting(true);
        try {
          await completeAccountSetupWithTemplate();
        } finally {
          setIsSubmitting(false);
        }
      } else {
        dispatch(setCurrentStep(currentStep + 1));
      }
    } else if (currentStep === 2) {
      setIsSubmitting(true);
      try {
        await completeAccountSetup();
      } finally {
        setIsSubmitting(false);
      }
    } else {
      dispatch(setCurrentStep(currentStep + 1));
    }
  }

  const goBack = () => {
    if (currentStep > 0) dispatch(setCurrentStep(currentStep - 1));
  };

  const languages = [
    { key: Language.EN, label: 'English', flag: '🇺🇸' },
    { key: Language.ES, label: 'Español', flag: '🇪🇸' },
    { key: Language.PT, label: 'Português', flag: '🇵🇹' },
    { key: Language.DE, label: 'Deutsch', flag: '🇩🇪' },
    { key: Language.ALB, label: 'Shqip', flag: '🇦🇱' },
    { key: Language.ZH, label: '简体中文', flag: '🇨🇳' },
  ];

  const handleLanguageChange = (languageKey: ILanguageType) => {
    dispatch(setLanguage(languageKey));
    i18n.changeLanguage(languageKey);

    // Persist to the backend (mirrors Settings > Language and Region) so the
    // choice survives past this wizard - verifyAuthentication() runs right
    // after setup completes and would otherwise revert the UI language back
    // to whatever is still saved on the account. timezone is sent as-is
    // (possibly undefined for a brand-new user); the backend preserves the
    // existing timezone_id when it isn't provided.
    timezonesApiService
      .update({ language: languageKey, timezone: userDetails?.timezone })
      .catch(error => logger.error('Failed to save language preference', error));
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
    onClick: () => handleLanguageChange(lang.key as ILanguageType),
  }));

  const currentLanguage = languages.find(lang => lang.key === lng) || languages[0];

  const switchAccountPopoverContent = (
    <div style={{ width: 260 }}>
      <Flex align="center" gap={12}>
        <SingleAvatar
          avatarUrl={userDetails?.avatar_url}
          name={userDetails?.name}
          email={userDetails?.email}
          size={44}
        />
        <Flex vertical style={{ minWidth: 0, flex: 1 }}>
          <Typography.Text strong ellipsis={{ tooltip: userDetails?.name }}>
            {userDetails?.name}
          </Typography.Text>
          <Typography.Text
            type="secondary"
            style={{ fontSize: 12 }}
            ellipsis={{ tooltip: userDetails?.email }}
          >
            {userDetails?.email}
          </Typography.Text>
        </Flex>
      </Flex>
      <Divider style={{ margin: '12px 0' }} />
      <Button block icon={<UserSwitchOutlined />} onClick={() => navigate('/auth/logging-out')}>
        {t('signInAnotherAccount', { defaultValue: 'Sign in with another account' })}
      </Button>
    </div>
  );

  return (
    <div
      className="wiz-shell"
      style={{ backgroundColor: token.colorBgLayout, color: token.colorText }}
    >
      {/* Switch account - top right */}
      <div className="absolute top-6 right-6" style={{ zIndex: 20 }}>
        <Popover
          content={switchAccountPopoverContent}
          trigger={['hover', 'click']}
          placement="bottomRight"
          overlayClassName="switch-account-popover"
        >
          <Button
            type="text"
            size="small"
            icon={
              <SingleAvatar
                avatarUrl={userDetails?.avatar_url}
                name={userDetails?.name}
                email={userDetails?.email}
              />
            }
            className="switch-account-trigger flex items-center"
            style={{ color: token?.colorTextSecondary }}
          >
            <span className="hidden sm:inline">
              {t('switchAccount', { defaultValue: 'Switch account' })}
            </span>
          </Button>
        </Popover>
      </div>

      {/* Header: logo + step indicator */}
      <div className="wiz-header">
        <div className="wiz-logo">
          <img src={isDarkMode ? logoDark : logo} alt="Worklenz" style={{ height: 26 }} />
          <span style={{ fontSize: 12.5, color: token.colorTextSecondary }}>
            · {t('setupYourAccount')}
          </span>
        </div>
        <div className="wiz-steps">
          {STEP_LABELS.map((label, idx) => {
            const isDone = idx < currentStep;
            const isActive = idx === currentStep;
            // AntD's cssVar mode isn't enabled in this app, so colors are applied
            // via inline styles rather than CSS custom properties. The done/active
            // circle uses the same fixed AUTH_PRIMARY_BUTTON_COLOR as the Continue
            // button (not the theme's colorPrimary token) so they always match.
            const circleStyle: React.CSSProperties = isDone
              ? {
                  background: AUTH_PRIMARY_BUTTON_COLOR,
                  borderColor: AUTH_PRIMARY_BUTTON_COLOR,
                  color: '#fff',
                }
              : isActive
                ? {
                    borderColor: AUTH_PRIMARY_BUTTON_COLOR,
                    color: AUTH_PRIMARY_BUTTON_COLOR,
                    background: token.colorBgLayout,
                    boxShadow: '0 0 0 3px rgba(6, 126, 252, 0.15)',
                  }
                : {
                    borderColor: token.colorBorder,
                    color: token.colorTextTertiary,
                    background: token.colorBgLayout,
                  };
            const labelStyle: React.CSSProperties = isDone
              ? { color: token.colorTextSecondary }
              : isActive
                ? { color: AUTH_PRIMARY_BUTTON_COLOR, fontWeight: 600 }
                : { color: token.colorTextTertiary };
            const lineStyle: React.CSSProperties = {
              background: isDone ? AUTH_PRIMARY_BUTTON_COLOR : token.colorBorder,
            };

            return (
              <div key={label} className="wiz-step-item">
                <div className="wiz-step-circle" style={circleStyle}>
                  {isDone ? '✓' : idx + 1}
                </div>
                <div className="wiz-step-label" style={labelStyle}>
                  {label}
                </div>
                {idx < STEP_LABELS.length - 1 && <div className="wiz-step-line" style={lineStyle} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="wiz-body">
        <div className="wiz-page-wrap">{stepContent[currentStep]}</div>
      </div>

      {/* Footer */}
      <div className="wiz-footer" style={{ borderTop: `1px solid ${token.colorBorder}` }}>
        <div className="wiz-page-wrap wiz-footer-inner">
          <div>
            {currentStep > 0 && (
              <Button
                type="text"
                disabled={isSubmitting}
                onClick={goBack}
                style={{
                  color: AUTH_PRIMARY_BUTTON_COLOR,
                  fontSize: 12,
                  paddingInline: 12,
                  marginLeft: -12,
                }}
              >
                {t('goBack')}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {currentStep === 2 && (
              <Button
                type="text"
                onClick={handleSkipMembers}
                loading={isSkipping}
                disabled={isSkipping || isSubmitting}
                style={{ color: AUTH_PRIMARY_BUTTON_COLOR, fontSize: 12 }}
              >
                {isSkipping ? t('skipping') : t('skipForNow')}
              </Button>
            )}
            <Button
              type="primary"
              disabled={isContinueDisabled()}
              loading={isSubmitting}
              onClick={nextStep}
              style={
                isContinueDisabled()
                  ? { fontSize: 12, padding: '0 20px' }
                  : {
                      fontSize: 12,
                      padding: '0 20px',
                      backgroundColor: AUTH_PRIMARY_BUTTON_COLOR,
                      borderColor: AUTH_PRIMARY_BUTTON_COLOR,
                    }
              }
            >
              {t('continue')}
            </Button>
          </div>
        </div>

        {/* Theme & language - pinned to the true right edge of the footer
            (mirrors the "Switch account" control pinned top-right), not the
            640px-wide centered wizard column. Drops below the back/continue
            row on narrow screens instead of overlapping Continue. */}
        <div className="wiz-footer-utils">
          <Button
            type="text"
            size="small"
            icon={isDarkMode ? <SunOutlined /> : <MoonOutlined />}
            onClick={handleThemeToggle}
            className="flex items-center"
            style={{ color: token?.colorTextTertiary }}
            title={
              isDarkMode
                ? t('switchToLightMode', { defaultValue: 'Switch to light mode' })
                : t('switchToDarkMode', { defaultValue: 'Switch to dark mode' })
            }
          />
          <Dropdown menu={{ items: languageMenuItems }} placement="topRight" trigger={['click']}>
            <Button
              type="text"
              size="small"
              icon={<GlobalOutlined />}
              className="flex items-center space-x-2"
              style={{ color: token?.colorTextTertiary }}
            >
              <span>{currentLanguage.flag}</span>
              <span className="hidden sm:inline">{currentLanguage.label}</span>
            </Button>
          </Dropdown>
        </div>
      </div>
    </div>
  );
};

export default AccountSetup;
