import React, { useMemo } from 'react';
import { Flex, Select, ConfigProvider } from '@/shared/antd-imports';
import type { DefaultOptionType } from 'antd/es/select';
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

interface UploadedByOption extends DefaultOptionType {
  value: string;
  label: string;
  member: ITeamMemberViewModel;
}

const FILE_TYPE_OPTIONS = Object.keys(IconsMap)
  .filter(type => type !== 'search')
  .map(type => ({ value: type, label: type.toUpperCase() }));

/** Avatar row height used by optionRender — Ant Design virtual list defaults to 24px. */
const UPLOADED_BY_OPTION_HEIGHT = 36;

const buildUploadedByOptions = (members: ITeamMemberViewModel[]): UploadedByOption[] => {
  const seenUserIds = new Set<string>();
  const options: UploadedByOption[] = [];

  for (const member of members) {
    // Guests cannot upload project files, so they are not valid Uploaded By filters.
    if (member.is_guest === true) continue;

    const userId = member.user_id?.trim();
    // uploaded_by filters against users.id — skip pending invites / missing user_id.
    // Duplicate values break Ant Design Select virtualization (items clone / disappear on scroll).
    if (!userId || seenUserIds.has(userId)) continue;

    seenUserIds.add(userId);
    options.push({
      value: userId,
      label: member.name || member.email || userId,
      member,
    });
  }

  return options;
};

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

  const uploadedByOptions = useMemo(() => buildUploadedByOptions(members), [members]);

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
          options={uploadedByOptions}
          listItemHeight={UPLOADED_BY_OPTION_HEIGHT}
          // Custom avatar rows are taller than the virtual-list default (24px); wrong
          // item height also causes options to scramble/duplicate while scrolling.
          virtual={false}
          optionRender={option => {
            const optionData = option.data as UploadedByOption;
            const label = optionData.label || String(optionData.value ?? '');

            return (
              <Flex align="center" gap={8}>
                <SingleAvatar avatarUrl={optionData.member?.avatar_url} name={label} />
                {label}
              </Flex>
            );
          }}
          style={{ width: 200, flexShrink: 0 }}
        />
      </ConfigProvider>
    </Flex>
  );
};
