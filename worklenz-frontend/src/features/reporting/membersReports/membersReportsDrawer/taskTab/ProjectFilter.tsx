import { IRPTOverviewProject } from '@/types/reporting/reporting.types';
import { Flex, Select, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

type ProjectFilterProps = {
  projectList: IRPTOverviewProject[];
  loading: boolean;
  onSelect: (value: string) => void;
};

const ProjectFilter = ({ projectList, loading, onSelect }: ProjectFilterProps) => {
  const { t } = useTranslation('reporting-members-drawer');

  const selectOptions = projectList.map(project => ({
    key: project.id,
    value: project.id,
    label: project.name,
  }));

  return (
    <Flex gap={4} align="center">
      <Typography.Text>{t('filterByText')}</Typography.Text>
      <Select
        placeholder={t('selectProjectPlaceholder')}
        options={selectOptions}
        loading={loading}
        onChange={onSelect}
        allowClear
      />
    </Flex>
  );
};

export default ProjectFilter;
