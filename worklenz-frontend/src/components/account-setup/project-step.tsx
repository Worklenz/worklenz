import React, { startTransition, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { Button, Drawer, Input, InputRef, Typography, Spin, Alert, Row, Col, Card, Tag } from '@/shared/antd-imports';
import TemplateDrawer from '../common/template-drawer/template-drawer';

import { RootState } from '@/app/store';
import { setProjectName, setTemplateId } from '@/features/account-setup/account-setup.slice';
import { sanitizeInput } from '@/utils/sanitizeInput';

import { projectTemplatesApiService } from '@/api/project-templates/project-templates.api.service';
import logger from '@/utils/errorLogger';

import { IProjectTemplate } from '@/types/project-templates/project-templates.types';

import { createPortal } from 'react-dom';
import { useAppDispatch } from '@/hooks/useAppDispatch';

const { Text } = Typography;

interface Props {
  onEnter: () => void;
  styles: any;
  isDarkMode: boolean;
  token?: any;
}

const GENERIC_PROJECT_CHIP_KEYS = [
  { key: 'projectChipWebsiteRedesign', defaultValue: 'Website Redesign' },
  { key: 'projectChipMarketingCampaign', defaultValue: 'Marketing Campaign' },
  { key: 'projectChipProductLaunch', defaultValue: 'Product Launch' },
  { key: 'projectChipClientOnboarding', defaultValue: 'Client Onboarding' },
];

export const ProjectStep: React.FC<Props> = ({ onEnter, styles, token }) => {
  const { t } = useTranslation('account-setup');
  const dispatch = useAppDispatch();

  const inputRef = useRef<InputRef>(null);

  const { projectName, templateId } = useSelector((state: RootState) => state.accountSetupReducer);
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<IProjectTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      setTemplateError(null);

      const templatesResponse = await projectTemplatesApiService.getWorklenzTemplates();

      if (templatesResponse.done && templatesResponse.body) {
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

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectTemplate = (id: string) => {
    dispatch(setTemplateId(id));
  };

  const toggleTemplateSelector = (isOpen: boolean) => {
    startTransition(() => setOpen(isOpen));
  };

  // Selecting a template inside the drawer auto-fires this same callback (it
  // pre-selects the first template on load too), so the drawer keeps its own
  // explicit "Create Project" confirm rather than closing on every select.
  const confirmTemplateSelection = () => {
    if (!templateId) return;
    toggleTemplateSelector(false);
    onEnter();
  };

  const onPressEnter = () => {
    if (projectName.trim()) onEnter();
  };

  const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setProjectName(sanitizeInput(e.target.value)));
  };

  const handleProjectNameFocus = () => {
    if (templateId) dispatch(setTemplateId(null));
  };

  const handleChipClick = (suggestion: string) => {
    dispatch(setProjectName(suggestion));
    if (templateId) dispatch(setTemplateId(null));
    inputRef.current?.focus();
  };

  return (
    <div className="w-full">
      <h2 className="wiz-h2" style={{ color: token?.colorText }}>
        {t('projectStepHeader')}
      </h2>
      <p className="wiz-sub" style={{ color: token?.colorTextSecondary }}>
        {t('projectStepSubheader')}
      </p>

      <label className="wiz-field-label" style={{ color: token?.colorTextSecondary }}>
        {t('startFromScratch')}
      </label>
      <Input
        size="large"
        placeholder={t('projectNameInputPlaceholder')}
        value={projectName}
        onChange={handleProjectNameChange}
        onPressEnter={onPressEnter}
        onFocus={handleProjectNameFocus}
        ref={inputRef}
      />

      <div className="wiz-suggest-label" style={{ color: token?.colorTextSecondary }}>
        <b style={{ color: token?.colorText }}>{t('popularStartingPoints')}</b>
      </div>
      <div className="wiz-chip-row">
        {GENERIC_PROJECT_CHIP_KEYS.map(({ key, defaultValue }) => {
          const chip = t(key, { defaultValue });
          const selected = projectName === chip;
          return (
            <button
              key={key}
              type="button"
              className="wiz-chip"
              onClick={() => handleChipClick(chip)}
              style={{
                borderColor: selected ? token?.colorPrimary : token?.colorBorder,
                background: selected ? token?.colorPrimary : token?.colorBgContainer,
                color: selected ? '#fff' : token?.colorText,
                fontWeight: selected ? 600 : 400,
              }}
            >
              {chip}
            </button>
          );
        })}
      </div>

      <div
        className="wiz-divider-or"
        style={{ color: token?.colorTextTertiary, ['--wiz-divider-color' as any]: token?.colorBorder }}
      >
        <span>{t('orText')}</span>
      </div>

      <label className="wiz-field-label" style={{ color: token?.colorTextSecondary }}>
        {t('startWithTemplate')}
      </label>

      {loadingTemplates ? (
        <div className="text-center py-8">
          <Spin size="large" />
        </div>
      ) : templateError ? (
        <Alert
          message={t('templatesLoadError', 'Failed to load templates')}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={fetchTemplates}>
              {t('retry', 'Retry')}
            </Button>
          }
        />
      ) : (
        <Row gutter={[10, 10]}>
          {templates.map(template => {
            const selected = templateId === template.id;
            return (
              <Col xs={24} sm={12} key={template.id}>
                <Card
                  hoverable
                  size="small"
                  styles={{ body: { padding: 10 } }}
                  style={{
                    borderColor: selected ? token?.colorPrimary : token?.colorBorder,
                    borderWidth: selected ? 2 : 1,
                    backgroundColor: token?.colorBgContainer,
                  }}
                  onClick={() => selectTemplate(template.id || '')}
                >
                  <div className="min-w-0">
                    <Text
                      strong
                      ellipsis
                      className="block text-xs"
                      style={{ color: token?.colorText, marginBottom: 4 }}
                    >
                      {template.name || t('untitledTemplate', 'Untitled Template')}
                    </Text>
                    <div className="flex flex-wrap gap-1">
                      {template.phases?.slice(0, 3).map((phase, index) => (
                        <Tag
                          key={index}
                          color={phase.color_code || 'blue'}
                          style={{ fontSize: 10, lineHeight: '16px', margin: 0, padding: '0 4px' }}
                        >
                          {phase.name}
                        </Tag>
                      ))}
                      {(template.phases?.length || 0) > 3 && (
                        <Tag style={{ fontSize: 10, lineHeight: '16px', margin: 0, padding: '0 4px' }}>
                          +{(template.phases?.length || 0) - 3}
                        </Tag>
                      )}
                    </div>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <a
        className="wiz-browse-all"
        style={{ color: token?.colorPrimary }}
        onClick={() => toggleTemplateSelector(true)}
      >
        {t('browseAllTemplates')} →
      </a>

      {createPortal(
        <Drawer
          title={
            <div>
              <Typography.Title level={4} style={{ marginBottom: 0 }}>
                {t('templateDrawerTitle')}
              </Typography.Title>
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
              <Button type="primary" onClick={confirmTemplateSelection} disabled={!templateId}>
                {t('createProject')}
              </Button>
            </div>
          }
          style={{ backgroundColor: token?.colorBgLayout }}
        >
          <TemplateDrawer
            showBothTabs={false}
            templateSelected={selectTemplate}
            selectedTemplateType={() => {}}
          />
        </Drawer>,
        document.body,
        'template-drawer'
      )}
    </div>
  );
};
