import React, { startTransition, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  Button,
  Drawer,
  Form,
  Input,
  InputRef,
  Typography,
  Card,
  Row,
  Col,
  Tag,
  Tooltip,
  Spin,
  Alert,
} from '@/shared/antd-imports';
import TemplateDrawer from '../common/template-drawer/template-drawer';

import { RootState } from '@/app/store';
import { setProjectName, setTemplateId } from '@/features/account-setup/account-setup.slice';
import { sanitizeInput } from '@/utils/sanitizeInput';

import { projectTemplatesApiService } from '@/api/project-templates/project-templates.api.service';
import logger from '@/utils/errorLogger';

import {
  IAccountSetupRequest,
  IWorklenzTemplate,
  IProjectTemplate,
} from '@/types/project-templates/project-templates.types';

import { evt_account_setup_template_complete } from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { createPortal } from 'react-dom';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { verifyAuthentication } from '@/features/auth/authSlice';
import { setUser } from '@/features/user/userSlice';
import { setSession } from '@/utils/session-helper';
import { IAuthorizeResponse } from '@/types/auth/login.types';

const { Title, Paragraph, Text } = Typography;

interface Props {
  onEnter: () => void;
  styles: any;
  isDarkMode: boolean;
  token?: any;
}

// Default icon mapping for templates (fallback if no image_url)
const getTemplateIcon = (name?: string) => {
  if (!name) return '📁';
  const lowercaseName = name.toLowerCase();
  if (lowercaseName.includes('software') || lowercaseName.includes('development')) return '💻';
  if (lowercaseName.includes('marketing') || lowercaseName.includes('campaign')) return '📢';
  if (lowercaseName.includes('construction') || lowercaseName.includes('building')) return '🏗️';
  if (lowercaseName.includes('startup') || lowercaseName.includes('launch')) return '🚀';
  if (lowercaseName.includes('design') || lowercaseName.includes('creative')) return '🎨';
  if (lowercaseName.includes('education') || lowercaseName.includes('learning')) return '📚';
  if (lowercaseName.includes('event') || lowercaseName.includes('planning')) return '📅';
  if (lowercaseName.includes('retail') || lowercaseName.includes('sales')) return '🛍️';
  return '📁';
};

const getProjectSuggestions = (orgType?: string) => {
  const suggestions: Record<string, string[]> = {
    freelancer: ['Client Website', 'Logo Design', 'Content Writing', 'App Development'],
    startup: ['MVP Development', 'Product Launch', 'Marketing Campaign', 'Investor Pitch'],
    small_medium_business: [
      'Q1 Sales Initiative',
      'Website Redesign',
      'Process Improvement',
      'Team Training',
    ],
    agency: ['Client Campaign', 'Brand Strategy', 'Website Project', 'Creative Brief'],
    enterprise: [
      'Digital Transformation',
      'System Migration',
      'Annual Planning',
      'Department Initiative',
    ],
    other: ['New Project', 'Team Initiative', 'Q1 Goals', 'Special Project'],
  };
  return suggestions[orgType || 'other'] || suggestions['other'];
};

export const ProjectStep: React.FC<Props> = ({ onEnter, styles, isDarkMode = false, token }) => {
  const { t } = useTranslation('account-setup');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { trackMixpanelEvent } = useMixpanelTracking();

  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      setTemplateError(null);

      // Fetch list of available templates
      const templatesResponse = await projectTemplatesApiService.getWorklenzTemplates();

      if (templatesResponse.done && templatesResponse.body) {
        // Fetch detailed information for first 4 templates for preview
        const templateDetails = await Promise.all(
          templatesResponse.body.slice(0, 4).map(async template => {
            if (template.id) {
              try {
                const detailResponse = await projectTemplatesApiService.getByTemplateId(
                  template.id
                );
                return detailResponse.done ? detailResponse.body : null;
              } catch (error) {
                logger.error(`Failed to fetch template details for ${template.id}`, error);
                return null;
              }
            }
            return null;
          })
        );

        // Filter out null results and set templates
        const validTemplates = templateDetails.filter(
          (template): template is IProjectTemplate => template !== null
        );
        setTemplates(validTemplates);
      }
    } catch (error) {
      logger.error('Failed to fetch templates', error);
      setTemplateError('Failed to load templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const { projectName, templateId, organizationName, surveyData } = useSelector(
    (state: RootState) => state.accountSetupReducer
  );
  const [open, setOpen] = useState(false);
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(templateId || null);
  const [templates, setTemplates] = useState<IProjectTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const projectSuggestions = getProjectSuggestions(surveyData.organization_type);

  const handleTemplateSelected = (templateId: string) => {
    if (!templateId) return;
    dispatch(setTemplateId(templateId));
  };

  const toggleTemplateSelector = (isOpen: boolean) => {
    startTransition(() => setOpen(isOpen));
  };

  const createFromTemplate = async () => {
    setCreatingFromTemplate(true);
    if (!templateId) return;
    try {
      const model: IAccountSetupRequest = {
        team_name: organizationName,
        project_name: null,
        template_id: templateId || null,
        tasks: [],
        team_members: [],
      };
      const res = await projectTemplatesApiService.setupAccount(model);
      if (res.done && res.body.id) {
        toggleTemplateSelector(false);
        trackMixpanelEvent(evt_account_setup_template_complete);
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
        navigate(`/worklenz/projects/${res.body.id}?tab=tasks-list&pinned_tab=tasks-list`);
      }
    } catch (error) {
      logger.error('createFromTemplate', error);
    }
  };

  const onPressEnter = () => {
    if (projectName.trim()) onEnter();
  };

  const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitizedValue = sanitizeInput(e.target.value);
    dispatch(setProjectName(sanitizedValue));
  };

  const handleProjectNameFocus = () => {
    if (templateId) {
      dispatch(setTemplateId(null));
      setSelectedTemplate(null);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    dispatch(setProjectName(suggestion));
    inputRef.current?.focus();
  };

  return (
    <div className="w-full project-step">
      {/* Header */}
      <div className="text-center mb-8">
        <Title level={3} className="mb-2" style={{ color: token?.colorText }}>
          {t('projectStepHeader')}
        </Title>
        <Paragraph className="text-base" style={{ color: token?.colorTextSecondary }}>
          {t('projectStepSubheader')}
        </Paragraph>
      </div>

      {/* Project Name Section */}
      <div className="mb-8">
        <Card
          className={`border-2 hover:shadow-md transition-all duration-200 ${
            templateId ? 'opacity-50' : ''
          }`}
          style={{
            borderColor: templateId ? token?.colorBorder : token?.colorPrimary,
            backgroundColor: token?.colorBgContainer,
          }}
        >
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <Text strong className="text-lg" style={{ color: token?.colorText }}>
                {t('startFromScratch')}
              </Text>
              {templateId && (
                <Text type="secondary" className="text-sm">
                  {t('templateSelected')}
                </Text>
              )}
            </div>
          </div>

          <Form.Item
            className="mb-4"
            label={
              <span className="font-medium" style={{ color: token?.colorText }}>
                {t('projectStepLabel')}
              </span>
            }
          >
            <Input
              size="large"
              placeholder={projectSuggestions[0] || t('projectStepPlaceholder')}
              value={projectName}
              onChange={handleProjectNameChange}
              onPressEnter={onPressEnter}
              onFocus={handleProjectNameFocus}
              ref={inputRef}
              className="text-base"
              style={{
                backgroundColor: token?.colorBgContainer,
                borderColor: token?.colorBorder,
                color: token?.colorText,
              }}
            />
          </Form.Item>

          <div>
            <Text type="secondary" className="text-sm">
              {t('quickSuggestions')}
            </Text>
            <div className="mt-2 flex flex-wrap gap-2">
              {projectSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-3 py-1 rounded-full text-sm border project-suggestion-button"
                  style={{
                    backgroundColor: token?.colorBgContainer,
                    borderColor: token?.colorBorder,
                    color: token?.colorTextSecondary,
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="relative my-8">
        <div
          className="absolute inset-0 flex items-center"
          style={{ color: token?.colorTextQuaternary }}
        >
          <div className="w-full border-t" style={{ borderColor: token?.colorBorder }}></div>
        </div>
        <div className="relative flex justify-center">
          <span
            className="px-4 text-sm font-medium"
            style={{ backgroundColor: token?.colorBgLayout, color: token?.colorTextSecondary }}
          >
            {t('orText')}
          </span>
        </div>
      </div>

      <div>
        <div className="text-center mb-6">
          <Title level={4} className="mb-2" style={{ color: token?.colorText }}>
            {t('startWithTemplate')}
          </Title>
          <Text type="secondary">{t('templateHeadStart')}</Text>
        </div>

        {/* Template Preview Cards */}
        <div className="mb-6">
          {loadingTemplates ? (
            <div className="text-center py-12">
              <Spin size="large" />
              <div className="mt-4">
                <Text type="secondary">Loading templates...</Text>
              </div>
            </div>
          ) : templateError ? (
            <Alert
              message="Failed to load templates"
              description={templateError}
              type="error"
              showIcon
              action={
                <Button size="small" onClick={fetchTemplates}>
                  Retry
                </Button>
              }
            />
          ) : (
            <Row gutter={[16, 16]}>
              {templates.map(template => (
                <Col xs={24} sm={12} key={template.id}>
                  <Card
                    hoverable
                    className={`h-full template-preview-card ${
                      selectedTemplate === template.id ? 'selected border-2' : ''
                    }`}
                    style={{
                      borderColor:
                        selectedTemplate === template.id ? token?.colorPrimary : token?.colorBorder,
                      backgroundColor: token?.colorBgContainer,
                    }}
                    onClick={() => {
                      setSelectedTemplate(template.id || null);
                      dispatch(setTemplateId(template.id || ''));
                    }}
                  >
                    <div className="flex items-start space-x-3">
                      {template.image_url ? (
                        <img
                          src={template.image_url}
                          alt={template.name}
                          className="w-12 h-12 object-cover rounded"
                          onError={e => {
                            // Fallback to icon if image fails to load
                            e.currentTarget.style.display = 'none';
                            if (e.currentTarget.nextSibling) {
                              (e.currentTarget.nextSibling as HTMLElement).style.display = 'block';
                            }
                          }}
                        />
                      ) : null}
                      <span
                        className="text-3xl"
                        style={{ display: template.image_url ? 'none' : 'block' }}
                      >
                        {getTemplateIcon(template.name)}
                      </span>
                      <div className="flex-1">
                        <Text strong className="block mb-2" style={{ color: token?.colorText }}>
                          {template.name || 'Untitled Template'}
                        </Text>
                        <div className="flex flex-wrap gap-1">
                          {template.phases?.slice(0, 3).map((phase, index) => (
                            <Tag key={index} color={phase.color_code || 'blue'} className="text-xs">
                              {phase.name}
                            </Tag>
                          ))}
                          {(template.phases?.length || 0) > 3 && (
                            <Tag className="text-xs">
                              +{(template.phases?.length || 0) - 3} more
                            </Tag>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </div>

        <div className="text-center">
          <Button
            type="primary"
            size="large"
            icon={<span className="mr-2">🎨</span>}
            onClick={() => toggleTemplateSelector(true)}
            className="min-w-[200px]"
          >
            {t('browseAllTemplates')}
          </Button>
          <div className="mt-2">
            <Text type="secondary" className="text-sm">
              {t('templatesAvailable')}
            </Text>
          </div>
        </div>
      </div>

      {/* Template Drawer */}
      {createPortal(
        <Drawer
          title={
            <div>
              <Title level={4} style={{ marginBottom: 0 }}>
                {t('templateDrawerTitle')}
              </Title>
              <Text type="secondary">{t('chooseTemplate')}</Text>
            </div>
          }
          width={1000}
          onClose={() => toggleTemplateSelector(false)}
          open={open}
          footer={
            <div style={styles.drawerFooter}>
              <Button style={{ marginRight: '8px' }} onClick={() => toggleTemplateSelector(false)}>
                {t('cancel')}
              </Button>
              <Button
                type="primary"
                onClick={() => createFromTemplate()}
                loading={creatingFromTemplate}
                disabled={!templateId}
              >
                {t('createProject')}
              </Button>
            </div>
          }
          style={{ backgroundColor: token?.colorBgLayout }}
        >
          <TemplateDrawer
            showBothTabs={false}
            templateSelected={handleTemplateSelected}
            selectedTemplateType={() => {}}
          />
        </Drawer>,
        document.body,
        'template-drawer'
      )}
    </div>
  );
};
