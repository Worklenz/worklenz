import dayjs from 'dayjs';
import { Flex, FormInstance } from '@/shared/antd-imports';

import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import BasicDetailsCard from './BasicDetailsCard';
import ClientManagerCard from './ClientManagerCard';
import TimelineEstimatesCard from './TimelineEstimatesCard';

interface GeneralSettingsSectionProps {
  form: FormInstance;
  project: IProjectViewModel | null;
  projectId: string | null;
  editMode: boolean;
  disabled: boolean;
  isFree: boolean;
  canAssignPm: boolean;
  selectedProjectManager: ITeamMemberViewModel | null;
  setSelectedProjectManager: (manager: ITeamMemberViewModel | null) => void;
  onUpgradeClick: () => void;
  disabledStartDate: (current: dayjs.Dayjs) => boolean;
  disabledEndDate: (current: dayjs.Dayjs) => boolean;
  onStartDateChange: (date: dayjs.Dayjs | null) => void;
  onEndDateChange: (date: dayjs.Dayjs | null) => void;
}

const GeneralSettingsSection = ({
  form,
  project,
  projectId,
  editMode,
  disabled,
  isFree,
  canAssignPm,
  selectedProjectManager,
  setSelectedProjectManager,
  onUpgradeClick,
  disabledStartDate,
  disabledEndDate,
  onStartDateChange,
  onEndDateChange,
}: GeneralSettingsSectionProps) => (
  <Flex vertical gap={16}>
    <BasicDetailsCard
      form={form}
      project={project ?? null}
      projectId={projectId}
      editMode={editMode}
      disabled={disabled}
      isFree={isFree}
    />
    <ClientManagerCard
      form={form}
      project={project ?? null}
      disabled={disabled}
      isFree={isFree}
      canAssignPm={canAssignPm}
      selectedProjectManager={selectedProjectManager}
      setSelectedProjectManager={setSelectedProjectManager}
      onUpgradeClick={onUpgradeClick}
    />
    <TimelineEstimatesCard
      form={form}
      disabled={disabled}
      disabledStartDate={disabledStartDate}
      disabledEndDate={disabledEndDate}
      onStartDateChange={onStartDateChange}
      onEndDateChange={onEndDateChange}
    />
  </Flex>
);

export default GeneralSettingsSection;
