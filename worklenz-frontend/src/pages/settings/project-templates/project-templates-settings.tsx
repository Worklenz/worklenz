import { Button, Card, Popconfirm, Table, TableProps, Tooltip, Typography } from '@/shared/antd-imports';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { DeleteOutlined } from '@/shared/antd-imports';
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
        <div
          style={{ display: 'flex', gap: '10px', justifyContent: 'right' }}
          className="button-visibilty"
        >
          {/* <Tooltip title={t('editToolTip')}>
            <Button
              size="small"
              onClick={() =>
                navigate(`/worklenz/settings/project-templates/edit/${record.id}/${record.name}`)
              }
            >
              <EditOutlined />
            </Button>
          </Tooltip> */}
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
        pagination={{ size: 'small' }}
        rowClassName={(_, index) =>
          `no-border-row ${index % 2 === 0 ? '' : themeMode === 'dark' ? 'dark-alternate-row-color' : 'alternate-row-color'}`
        }
        rowKey="id"
      />
    </Card>
  );
};

export default ProjectTemplatesSettings;
