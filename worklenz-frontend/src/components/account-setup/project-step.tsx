import React, { startTransition, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button, Drawer, Form, Input, InputRef, Typography, Card, Row, Col, Tag, Tooltip } from '@/shared/antd-imports';
import TemplateDrawer from '../common/template-drawer/template-drawer';

import { RootState } from '@/app/store';
import { setProjectName, setTemplateId } from '@/features/account-setup/account-setup.slice';
import { sanitizeInput } from '@/utils/sanitizeInput';

import { projectTemplatesApiService } from '@/api/project-templates/project-templates.api.service';
import logger from '@/utils/errorLogger';

import { IAccountSetupRequest } from '@/types/project-templates/project-templates.types';

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

// Popular template suggestions
const templateSuggestions = [
  { 
    id: 'software', 
    title: 'Software Development', 
    icon: '💻', 
    description: 'Agile sprints, bug tracking, releases',
    tags: ['Agile', 'Scrum', 'Development']
  },
  { 
    id: 'marketing', 
    title: 'Marketing Campaign', 
    icon: '📢', 
    description: 'Campaign planning, content calendar',
    tags: ['Content', 'Social Media', 'Analytics']
  },
  { 
    id: 'construction', 
    title: 'Construction Project', 
    icon: '🏗️', 
    description: 'Phases, permits, contractors',
    tags: ['Planning', 'Execution', 'Inspection']
  },
  { 
    id: 'startup', 
    title: 'Startup Launch', 
    icon: '🚀', 
    description: 'MVP development, funding, growth',
    tags: ['MVP', 'Funding', 'Launch']
  }
];

// Project name suggestions based on organization type
const getProjectSuggestions = (orgType?: string) => {
  const suggestions: Record<string, string[]> = {
    'freelancer': ['Client Website', 'Logo Design', 'Content Writing', 'App Development'],
    'startup': ['MVP Development', 'Product Launch', 'Marketing Campaign', 'Investor Pitch'],
    'small_medium_business': ['Q1 Sales Initiative', 'Website Redesign', 'Process Improvement', 'Team Training'],
    'agency': ['Client Campaign', 'Brand Strategy', 'Website Project', 'Creative Brief'],
    'enterprise': ['Digital Transformation', 'System Migration', 'Annual Planning', 'Department Initiative'],
    'other': ['New Project', 'Team Initiative', 'Q1 Goals', 'Special Project']
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
  }, []);


  const { projectName, templateId, organizationName, surveyData } = useSelector(
    (state: RootState) => state.accountSetupReducer
  );
  const [open, setOpen] = useState(false);
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(templateId || null);

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
      logger.error('createFromTemplate', error);
    }
  };

  const onPressEnter = () => {
    if (!projectName.trim()) return;
    onEnter();
  };

  const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitizedValue = sanitizeInput(e.target.value);
    dispatch(setProjectName(sanitizedValue));
  };

  const handleProjectNameFocus = () => {
    // Clear template selection when user focuses on project name input
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
          Let's create your first project
        </Title>
        <Paragraph className="text-base" style={{ color: token?.colorTextSecondary }}>
          Start from scratch or use a template to get going faster
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
            backgroundColor: token?.colorBgContainer 
          }}
        >
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <Text strong className="text-lg" style={{ color: token?.colorText }}>
                Start from scratch
              </Text>
              {templateId && (
                <Text type="secondary" className="text-sm">
                  Template selected below
                </Text>
              )}
            </div>
          </div>
          
          <Form.Item 
            className="mb-4"
            label={<span className="font-medium" style={{ color: token?.colorText }}>{t('projectStepLabel')}</span>}
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
                color: token?.colorText
              }}
            />
          </Form.Item>

          {/* Quick suggestions */}
          <div>
            <Text type="secondary" className="text-sm">
              Quick suggestions:
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
                    color: token?.colorTextSecondary
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* OR Divider */}
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
            style={{ 
              backgroundColor: token?.colorBgLayout,
              color: token?.colorTextSecondary 
            }}
          >
            OR
          </span>
        </div>
      </div>

      {/* Template Section */}
      <div>
        <div className="text-center mb-6">
          <Title level={4} className="mb-2" style={{ color: token?.colorText }}>
            Start with a template
          </Title>
          <Text type="secondary">
            {projectName?.trim() 
              ? "Clear project name above to select a template" 
              : "Get a head start with pre-built project structures"
            }
          </Text>
        </div>

        {/* Template Preview Cards */}
        <Row gutter={[16, 16]} className="mb-6">
          {templateSuggestions.map((template) => (
            <Col xs={24} sm={12} key={template.id}>
              <Card
                hoverable={!projectName?.trim()}
                className={`h-full template-preview-card ${
                  selectedTemplate === template.id ? 'selected border-2' : ''
                } ${projectName?.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{ 
                  borderColor: selectedTemplate === template.id ? token?.colorPrimary : token?.colorBorder,
                  backgroundColor: token?.colorBgContainer
                }}
                onClick={() => {
                  if (projectName?.trim()) return; // Don't allow selection if project name is entered
                  setSelectedTemplate(template.id);
                  dispatch(setTemplateId(template.id));
                }}
              >
                <div className="flex items-start space-x-3">
                  <span className="text-3xl">{template.icon}</span>
                  <div className="flex-1">
                    <Text strong className="block mb-1" style={{ color: token?.colorText }}>
                      {template.title}
                    </Text>
                    <Text type="secondary" className="text-sm block mb-2">
                      {template.description}
                    </Text>
                    <div className="flex flex-wrap gap-1">
                      {template.tags.map((tag, index) => (
                        <Tag 
                          key={index} 
                          color="blue"
                          className="text-xs"
                        >
                          {tag}
                        </Tag>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        {/* Browse All Templates Button */}
        <div className="text-center">
          <Button 
            type="primary" 
            size="large"
            icon={<span className="mr-2">🎨</span>}
            onClick={() => toggleTemplateSelector(true)}
            className="min-w-[200px]"
            disabled={!!projectName?.trim()}
          >
            Browse All Templates
          </Button>
          <div className="mt-2">
            <Text type="secondary" className="text-sm">
              15+ industry-specific templates available
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
              <Text type="secondary">
                Choose a template that matches your project type
              </Text>
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
                {t('create')} Project
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