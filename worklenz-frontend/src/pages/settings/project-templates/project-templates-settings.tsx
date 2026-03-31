import './project-templates-settings.css';
import {
  Button,
  Card,
  Popconfirm,
  Table,
  TableProps,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { DeleteOutlined, EditOutlined } from '@/shared/antd-imports';
import { ProjectTemplateRenameModal } from '@/components/project-templates/project-template-rename-modal';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { projectTemplatesApiService } from '@/api/project-templates/project-templates.api.service';
import logger from '@/utils/errorLogger';
import { ICustomTemplate } from '@/types/project-templates/project-templates.types';

const ProjectTemplatesSettings = () => {
  const { t } = useTranslation('settings/project-templates');

  const [projectTemplates, setProjectTemplates] = useState<ICustomTemplate[]>([]);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const navigate = useNavigate();

  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>('');

  useDocumentTitle('Project Templates');

  const fetchProjectTemplates = async () => {
    try {
      const response = await projectTemplatesApiService.getCustomTemplates();
      setProjectTemplates(response.body);
    } catch (error) {
      logger.error('Failed to fetch project templates:', error);
    }
  };

  const deleteProjectTemplate = async (id: string) => {
    try {
      const res = await projectTemplatesApiService.deleteCustomTemplate(id);
      if (res.done) {
        fetchProjectTemplates();
      }
    } catch (error) {
      logger.error('Failed to delete project template:', error);
    }
  };

  const columns: TableProps<ICustomTemplate>['columns'] = [
    {
      key: 'name',
      title: t('nameColumn'),
      dataIndex: 'name',
    },
    {
      key: 'button',
      render: record => (
        <div className="button-visibilty">
          <Tooltip title={t('editToolTip')}>
            <Button
              size="small"
              onClick={() => {
                setSelectedTemplateId(record.id);
                setSelectedTemplateName(record.name);
                setRenameModalVisible(true);
              }}
            >
              <EditOutlined />
            </Button>
          </Tooltip>
          <Tooltip title={t('deleteToolTip')}>
            <Popconfirm
              title={
                <Typography.Text style={{ fontWeight: 400 }}>{t('confirmText')}</Typography.Text>
              }
              okText={t('okText')}
              cancelText={t('cancelText')}
              onConfirm={() => deleteProjectTemplate(record.id)}
            >
              <Button size="small">
                <DeleteOutlined />
              </Button>
            </Popconfirm>
          </Tooltip>
        </div>
      ),
    },
  ];

  useEffect(() => {
    fetchProjectTemplates();
  }, []);

  return (
    <Card style={{ width: '100%' }}>
      <Table
        columns={columns}
        dataSource={projectTemplates}
        size="small"
        // ✅ FIXED: added pageSize, showSizeChanger and showTotal for full pagination support
        pagination={{
          size: 'small',
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} templates`,
        }}
        rowClassName={(_, index) =>
          `no-border-row ${index % 2 === 0 ? '' : themeMode === 'dark' ? 'dark-alternate-row-color' : 'alternate-row-color'}`
        }
        rowKey="id"
      />
      <ProjectTemplateRenameModal
        visible={renameModalVisible}
        templateId={selectedTemplateId}
        currentName={selectedTemplateName}
        onClose={renamed => {
          setRenameModalVisible(false);
          setSelectedTemplateId(null);
          setSelectedTemplateName('');
          if (renamed) fetchProjectTemplates();
        }}
      />
    </Card>
  );
};

export default ProjectTemplatesSettings;