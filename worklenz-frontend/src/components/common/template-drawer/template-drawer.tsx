import type { MenuProps } from '@/shared/antd-imports';
import {
  Empty,
  List,
  Menu,
  Skeleton,
  Tabs,
  Tag,
  Typography,
  Image,
  Input,
  Flex,
  theme,
} from '@/shared/antd-imports';
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { RootState } from '@/app/store';
import { projectTemplatesApiService } from '@/api/project-templates/project-templates.api.service';
import {
  ICustomTemplate,
  IProjectTemplate,
  IWorklenzTemplate,
} from '@/types/project-templates/project-templates.types';
import './template-drawer.css';
import { SearchOutlined } from '@/shared/antd-imports';
import logger from '@/utils/errorLogger';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import {
  evt_project_import_from_template_click,
  evt_project_import_tasks_click,
} from '@/shared/worklenz-analytics-events';

const { Title, Text } = Typography;

interface TemplateDrawerProps {
  showBothTabs: boolean;
  templateSelected: (templateId: string) => void;
  selectedTemplateType: (type: 'worklenz' | 'custom') => void;
}

const TemplateDrawer: React.FC<TemplateDrawerProps> = ({
  showBothTabs = false,
  templateSelected = (templateId: string) => {
    if (!templateId) return;
  },
  selectedTemplateType = (type: 'worklenz' | 'custom') => {},
}) => {
  const themeMode = useSelector((state: RootState) => state.themeReducer.mode);
  const { token } = theme.useToken();
  const { t } = useTranslation('template-drawer');
  const { trackMixpanelEvent } = useMixpanelTracking();

  const [searchQuery, setSearchQuery] = useState('');
  const [templates, setTemplates] = useState<IWorklenzTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [customTemplates, setCustomTemplates] = useState<ICustomTemplate[]>([]);
  const [loadingCustomTemplates, setLoadingCustomTemplates] = useState(false);

  const [selectedTemplate, setSelectedTemplate] = useState<IProjectTemplate | null>(null);
  const [loadingSelectedTemplate, setLoadingSelectedTemplate] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const getSelectedTemplate = async (templateId: string) => {
    try {
      setLoadingSelectedTemplate(true);
      const res = await projectTemplatesApiService.getByTemplateId(templateId);
      if (res.done) {
        setSelectedTemplate(res.body);
      }
    } catch (error) {
      logger.error('Error loading template:', error);
    } finally {
      setLoadingSelectedTemplate(false);
    }
  };

  const getTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const res = await projectTemplatesApiService.getWorklenzTemplates();
      if (res.done) {
        setTemplates(res.body);
        if (res.body.length > 0 && res.body[0].id) {
          templateSelected(res.body[0].id);
          await getSelectedTemplate(res.body[0].id);
        }
      }
    } catch (error) {
      logger.error('Error loading templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const getCustomTemplates = async () => {
    try {
      setLoadingCustomTemplates(true);
      const res = await projectTemplatesApiService.getCustomTemplates();
      if (res.done) {
        setCustomTemplates(res.body);
        setCurrentPage(1);
      }
    } catch (error) {
      logger.error('Error loading custom templates:', error);
    } finally {
      setLoadingCustomTemplates(false);
    }
  };

  useEffect(() => {
    getTemplates();
    trackMixpanelEvent(evt_project_import_from_template_click, { source: 'template_drawer' });
  }, []);

  const menuItems: MenuProps['items'] = templates.map(template => ({
    key: template.id || '',
    label: template.name || t('untitled'),
    type: 'item',
  }));

  const handleMenuClick = (templateId: string) => {
    templateSelected(templateId);
    getSelectedTemplate(templateId);
    trackMixpanelEvent(evt_project_import_tasks_click, {
      selected_template_id: templateId,
      template_type: 'worklenz',
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const filteredCustomTemplates = customTemplates.filter(template =>
    template.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderTemplateDetails = () => {
    if (!selectedTemplate) {
      return <Empty description={t('noTemplateSelected')} />;
    }

    return (
      <div>
        <div className="template-detail-row mt-2">
          <div className="template-detail-label">
            <Text strong>{t('description')}</Text>
          </div>
          <div>
            <Text>{selectedTemplate.description || t('noDescription')}</Text>
          </div>
        </div>

        <div className="template-detail-row mt-2">
          <div className="template-detail-label">
            <Text strong>{t('phase')}</Text>
          </div>
          <div>
            {selectedTemplate.phases?.length ? (
              selectedTemplate.phases.map(phase => (
                <Tag
                  key={phase.name}
                  color={phase.color_code}
                  style={{
                    color: token.colorText,
                    marginBottom: '8px',
                    backgroundColor: phase.color_code ? undefined : token.colorBgContainer,
                    borderColor: phase.color_code ? undefined : token.colorBorder,
                  }}
                >
                  {phase.name}
                </Tag>
              ))
            ) : (
              <Text type="secondary">{t('noPhases')}</Text>
            )}
          </div>
        </div>

        <div className="template-detail-row mt-2">
          <div className="template-detail-label">
            <Text strong>{t('statuses')}</Text>
          </div>
          <div>
            {selectedTemplate.status?.length ? (
              selectedTemplate.status.map(status => (
                <Tag
                  key={status.name}
                  color={status.color_code}
                  style={{
                    color: token.colorText,
                    marginBottom: '8px',
                    backgroundColor: status.color_code ? undefined : token.colorBgContainer,
                    borderColor: status.color_code ? undefined : token.colorBorder,
                  }}
                >
                  {status.name}
                </Tag>
              ))
            ) : (
              <Text type="secondary">{t('noStatuses')}</Text>
            )}
          </div>
        </div>

        <div className="template-detail-row mt-2">
          <div className="template-detail-label">
            <Text strong>{t('priorities')}</Text>
          </div>
          <div>
            {selectedTemplate.priorities?.length ? (
              selectedTemplate.priorities.map(priority => (
                <Tag
                  key={priority.name}
                  color={priority.color_code}
                  style={{
                    color: token.colorText,
                    marginBottom: '8px',
                    backgroundColor: priority.color_code ? undefined : token.colorBgContainer,
                    borderColor: priority.color_code ? undefined : token.colorBorder,
                  }}
                >
                  {priority.name}
                </Tag>
              ))
            ) : (
              <Text type="secondary">{t('noPriorities')}</Text>
            )}
          </div>
        </div>

        <div className="template-detail-row mt-2">
          <div className="template-detail-label">
            <Text strong>{t('labels')}</Text>
          </div>
          <div>
            {selectedTemplate.labels?.length ? (
              selectedTemplate.labels.map(label => (
                <Tag
                  key={label.name}
                  color={label.color_code}
                  style={{
                    color: token.colorText,
                    marginBottom: '8px',
                    backgroundColor: label.color_code ? undefined : token.colorBgContainer,
                    borderColor: label.color_code ? undefined : token.colorBorder,
                  }}
                >
                  {label.name}
                </Tag>
              ))
            ) : (
              <Text type="secondary">{t('noLabels')}</Text>
            )}
          </div>
        </div>

        <div className="template-detail-row mt-2">
          <div className="template-detail-label">
            <Text strong>{t('tasks')}</Text>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            {selectedTemplate.tasks?.length ? (
              <List
                dataSource={selectedTemplate.tasks}
                renderItem={item => (
                  <List.Item key={item.name}>
                    <Text>{item.name}</Text>
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">{t('noTasks')}</Text>
            )}
          </div>
        </div>
      </div>
    );
  };

  const menuContent = (
    <div style={{ display: 'flex', height: '100%', backgroundColor: token.colorBgContainer }}>
      <div
        style={{
          minWidth: '250px',
          overflowY: 'auto',
          height: '100%',
          backgroundColor: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorder}`,
        }}
      >
        <Skeleton loading={loadingTemplates} active>
          <Menu
            className="template-menu"
            onClick={({ key }) => handleMenuClick(key)}
            style={{
              width: 256,
              backgroundColor: token.colorBgContainer,
              borderColor: token.colorBorder,
            }}
            defaultSelectedKeys={[templates[0]?.id || '']}
            mode="inline"
            items={menuItems}
          />
        </Skeleton>
      </div>
      <div
        className="temp-details"
        style={{
          flex: 1,
          maxHeight: '100%',
          padding: '16px',
          backgroundColor: token.colorBgContainer,
          color: token.colorText,
        }}
      >
        <Title level={4} style={{ color: token.colorText }}>
          Details
        </Title>
        <Skeleton loading={loadingSelectedTemplate} active>
          {selectedTemplate?.image_url && (
            <Image preview={false} src={selectedTemplate.image_url} alt={selectedTemplate.name} />
          )}
          {renderTemplateDetails()}
        </Skeleton>
      </div>
    </div>
  );

  const handleCustomTemplateClick = (templateId: string) => {
    const updatedCustomTemplates = customTemplates.map(template =>
      template.id === templateId
        ? { ...template, selected: true }
        : { ...template, selected: false }
    );
    setCustomTemplates(updatedCustomTemplates);
    templateSelected(templateId);
    selectedTemplateType('custom');
    trackMixpanelEvent(evt_project_import_tasks_click, {
      selected_template_id: templateId,
      template_type: 'custom',
    });
  };

  const customTemplatesContent = (
    <div
      style={{
        backgroundColor: token.colorBgContainer,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* ✅ FIXED: search bar is outside scroll area — always stays at top */}
      <div
        style={{
          padding: '16px 16px 8px 16px',
          backgroundColor: token.colorBgContainer,
          flexShrink: 0, // ← prevents search bar from shrinking
        }}
      >
        <Input
          placeholder={t('searchTemplates')}
          suffix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          style={{
            maxWidth: '300px',
            backgroundColor: token.colorBgContainer,
            borderColor: token.colorBorder,
            color: token.colorText,
          }}
          onChange={handleSearchChange}
        />
      </div>

      {/* ✅ FIXED: only this section scrolls, search bar stays fixed above */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 16px 16px 16px',
        }}
      >
        <List
          className="custom-template-list"
          bordered
          dataSource={filteredCustomTemplates}
          loading={loadingCustomTemplates}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: filteredCustomTemplates.length,
            size: 'small',
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} templates`,
            style: { marginTop: '12px', textAlign: 'right' },
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
          }}
          style={{
            backgroundColor: token.colorBgContainer,
            borderColor: token.colorBorder,
          }}
          renderItem={item => (
            <List.Item
              key={item.id}
              onClick={() => handleCustomTemplateClick(item.id || '')}
              style={{
                backgroundColor: item.selected ? token.colorPrimaryBg : token.colorBgContainer,
                borderColor: item.selected ? token.colorPrimary : token.colorBorder,
                color: token.colorText,
                cursor: 'pointer',
              }}
              className={
                item.selected && themeMode === 'dark'
                  ? 'selected-custom-template-dark'
                  : item.selected && themeMode === 'light'
                    ? 'selected-custom-template'
                    : ''
              }
            >
              <span style={{ color: token.colorText }}>{item.name}</span>
            </List.Item>
          )}
        />
      </div>
    </div>
  );

  const tabs = [
    {
      key: '1',
      label: t('worklenzTemplates'),
      children: menuContent,
    },
    {
      key: '2',
      label: t('yourTemplatesLibrary'),
      children: customTemplatesContent,
    },
  ];

  const handleTabChange = (key: string) => {
    if (key === '1') {
      getTemplates();
      selectedTemplateType('worklenz');
      trackMixpanelEvent(evt_project_import_from_template_click, { template_tab: 'worklenz' });
    } else {
      getCustomTemplates();
      selectedTemplateType('custom');
      trackMixpanelEvent(evt_project_import_from_template_click, { template_tab: 'custom' });
    }
  };

  return (
    <div
      className="template-drawer-content"
      style={{
        height: '100%',
        overflow: 'hidden',
        backgroundColor: token.colorBgLayout,
      }}
    >
      {showBothTabs ? (
        <Tabs
          type="card"
          items={tabs}
          onChange={handleTabChange}
          destroyOnHidden
          style={{
            height: '100%',
            backgroundColor: token.colorBgContainer,
          }}
        />
      ) : (
        menuContent
      )}
    </div>
  );
};

export default TemplateDrawer;