import { useEffect, useMemo, useState } from 'react';

import { projectMembersApiService } from '@/api/project-members/project-members.api.service';
import { IProjectMemberViewModel } from '@/types/projectMember.types';

/** Active project members as Select options (value = team member id). Loads while `isEnabled`. */
export const useProjectMemberOptions = (projectId: string | null | undefined, isEnabled: boolean) => {
  const [members, setMembers] = useState<IProjectMemberViewModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isEnabled || !projectId) return;
    let isCancelled = false;
    const loadMembers = async () => {
      setIsLoading(true);
      try {
        const response = await projectMembersApiService.getByProjectId(projectId);
        if (!isCancelled && response.done) setMembers(response.body ?? []);
      } catch {
        if (!isCancelled) setMembers([]);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };
    void loadMembers();
    return () => {
      isCancelled = true;
    };
  }, [isEnabled, projectId]);

  const options = useMemo(
    () =>
      members
        .filter(member => !!member.team_member_id && !member.pending_invitation)
        .map(member => ({
          value: member.team_member_id as string,
          label: member.name || member.email || '',
        })),
    [members]
  );

  return { options, isLoading };
};
