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

  const [searchQuery, setSearchQuery] = useState('');
  const [templates, setTemplates] = useState<IWorklenzTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [customTemplates, setCustomTemplates] = useState<ICustomTemplate[]>([]);
  const [loadingCustomTemplates, setLoadingCustomTemplates] = useState(false);

  const [selectedTemplate, setSelectedTemplate] = useState<IProjectTemplate | null>(null);
  const [loadingSelectedTemplate, setLoadingSelectedTemplate] = useState(false);

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
      }
    } catch (error) {
      logger.error('Error loading custom templates:', error);
    } finally {
      setLoadingCustomTemplates(false);
    }
  };

  useEffect(() => {
    getTemplates();
  }, []);

  const menuItems: MenuProps['items'] = templates.map(template => ({
    key: template.id || '',
    label: template.name || t('untitled'),
    type: 'item',
  }));

  const handleMenuClick = (templateId: string) => {
    templateSelected(templateId);
    getSelectedTemplate(templateId);
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
        {/* Description */}
        <div className="template-detail-row mt-2">
          <div className="template-detail-label">
            <Text strong>{t('description')}</Text>
          </div>
          <div>
            <Text>{selectedTemplate.description || t('noDescription')}</Text>
          </div>
        </div>

        {/* Phase */}
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

        {/* Statuses */}
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

        {/* Priorities */}
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

        {/* Labels */}
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

        {/* Tasks */}
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
    <div style={{ display: 'flex', backgroundColor: token.colorBgContainer }}>
      {/* Menu Area */}
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
      {/* Content Area */}
      <div
        className="temp-details"
        style={{
          flex: 1,
          maxHeight: 'calc(100vh - 200px)',
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
  };

  const customTemplatesContent = (
    <div style={{ backgroundColor: token.colorBgContainer, padding: '16px' }}>
      <Flex justify="space-between" align="center">
        <Input
          placeholder={t('searchTemplates')}
          suffix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          style={{
            maxWidth: '300px',
            backgroundColor: token.colorBgContainer,
            borderColor: token.colorBorder,
            color: token.colorText,
          }}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </Flex>

      <List
        className="custom-template-list mt-4"
        bordered
        dataSource={filteredCustomTemplates}
        loading={loadingCustomTemplates}
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
    } else {
      getCustomTemplates();
      selectedTemplateType('custom');
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: token.colorBgLayout,
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: token.colorBgContainer,
          overflow: 'hidden',
          borderBottom: `1px solid ${token.colorBorder}`,
        }}
      >
        {showBothTabs ? (
          <Tabs
            type="card"
            items={tabs}
            onChange={handleTabChange}
            destroyInactiveTabPane
            style={{
              backgroundColor: token.colorBgContainer,
            }}
          />
        ) : (
          menuContent
        )}
      </div>
    </div>
  );
};

export default TemplateDrawer;
