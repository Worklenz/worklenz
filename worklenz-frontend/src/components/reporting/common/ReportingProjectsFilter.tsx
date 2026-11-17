import { memo, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Flex,
  Input,
  Spin,
  Typography,
} from '@/shared/antd-imports';
import { CaretDownFilled, SearchOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

export interface IReportingProject {
  id: string;
  name: string;
  color_code?: string;
}

interface Props {
  projects: IReportingProject[];
  selectedProjects: string[];
  loading?: boolean;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
}

const ReportingProjectsFilter = ({
  projects,
  selectedProjects,
  loading,
  disabled,
  onChange,
}: Props) => {
  const { t } = useTranslation('reporting-all-tasks');
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase())),
    [projects, search]
  );

  const handleToggle = (id: string, checked: boolean) => {
    onChange(checked ? [...selectedProjects, id] : selectedProjects.filter(s => s !== id));
  };

  const handleClear = () => onChange([]);

  const dropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8, width: 280 } }}>
      <Flex vertical gap={8}>
        <Input
          placeholder={t('searchProjects', { defaultValue: 'Search projects' })}
          prefix={<SearchOutlined />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
        />
        <Flex justify="flex-end">
          <Button type="link" size="small" onClick={handleClear}>
            {t('clearAll', { defaultValue: 'Clear All' })}
          </Button>
        </Flex>
        {loading ? (
          <Flex justify="center" style={{ padding: 16 }}>
            <Spin size="small" />
          </Flex>
        ) : (
          <Flex vertical gap={4} style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filtered.map(project => (
              <Checkbox
                key={project.id}
                checked={selectedProjects.includes(project.id)}
                onChange={e => handleToggle(project.id, e.target.checked)}
              >
                <Flex align="center" gap={8}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: project.color_code || '#1890ff',
                      flexShrink: 0,
                    }}
                  />
                  {project.name}
                </Flex>
              </Checkbox>
            ))}
          </Flex>
        )}
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomLeft"
      disabled={disabled}
    >
      <Button loading={loading} disabled={loading}>
        <Flex align="center" gap={4}>
          {t('projectsFilter', { defaultValue: 'Projects' })}
          {selectedProjects.length > 0 && (
            <Typography.Text type="secondary">({selectedProjects.length})</Typography.Text>
          )}
          <CaretDownFilled />
        </Flex>
      </Button>
    </Dropdown>
  );
};

export default memo(ReportingProjectsFilter);
