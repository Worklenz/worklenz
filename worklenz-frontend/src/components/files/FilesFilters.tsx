import React from 'react';
import { Flex, Select, ConfigProvider } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useGetProjectsQuery } from '@/api/projects/projects.v1.api.service';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { IconsMap } from '@/shared/constants';

export interface FilesFiltersValue {
  projectId?: string;
  uploadedBy?: string;
  fileType?: string;
}

interface FilesFiltersProps {
  value: FilesFiltersValue;
  onChange: (value: FilesFiltersValue) => void;
  showFileType?: boolean;
}

const FILE_TYPE_OPTIONS = Object.keys(IconsMap)
  .filter(type => type !== 'search')
  .map(type => ({ value: type, label: type.toUpperCase() }));

export const FilesFilters: React.FC<FilesFiltersProps> = ({ value, onChange, showFileType = true }) => {
  const { t } = useTranslation('team-files');

  const { data: projectsData } = useGetProjectsQuery({
    index: 1,
    size: 200,
    field: 'name',
    order: 'asc',
    search: '',
    filter: null,
    statuses: '',
    categories: '',
    priorities: '',
    clients: '',
  });

  const [members, setMembers] = React.useState<ITeamMemberViewModel[]>([]);

  React.useEffect(() => {
    teamMembersApiService
      .getAll()
      .then(res => setMembers(res.body || []))
      .catch(() => setMembers([]));
  }, []);

  return (
    <Flex gap={12} wrap="wrap" align="center">
      <ConfigProvider
        theme={{
          components: {
            Select: { controlHeight: 30, fontSize: 12, borderRadius: 7 },
          },
        }}
      >
        <Select
          allowClear
          showSearch
          placeholder={t('filterProject', { defaultValue: 'All Projects' })}
          value={value.projectId}
          onChange={projectId => onChange({ ...value, projectId })}
          filterOption={(input, opt) =>
            (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())
          }
          options={(projectsData?.body?.data || []).map(p => ({
            value: p.id as string,
            label: p.name as string,
          }))}
          style={{ width: 180, flexShrink: 0 }}
        />
        {showFileType && (
          <Select
            allowClear
            showSearch
            placeholder={t('filterFileType', { defaultValue: 'File Type' })}
            value={value.fileType}
            onChange={fileType => onChange({ ...value, fileType })}
            filterOption={(input, opt) =>
              (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
            options={FILE_TYPE_OPTIONS}
            style={{ width: 140, flexShrink: 0 }}
          />
        )}
        <Select
          allowClear
          showSearch
          placeholder={t('filterUploadedBy', { defaultValue: 'Uploaded By' })}
          value={value.uploadedBy}
          onChange={uploadedBy => onChange({ ...value, uploadedBy })}
          filterOption={(input, opt) =>
            (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())
          }
          optionLabelProp="label"
          options={members.map(m => ({
            value: m.user_id as string,
            label: m.name as string,
            member: m,
          }))}
          optionRender={option => (
            <Flex align="center" gap={8}>
              <SingleAvatar avatarUrl={option.data.member?.avatar_url} name={option.data.label} />
              {option.data.label}
            </Flex>
          )}
          style={{ width: 200, flexShrink: 0 }}
        />
      </ConfigProvider>
    </Flex>
  );
};
