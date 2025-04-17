export type MemberType = {
  memberId: string;
  memberName: string;
  memberEmail: string;
  projects?: number;
  jobTitle?: string;
  memberRole: 'owner' | 'member' | 'admin';
  isActivate: boolean | null;
  isInivitationAccept: boolean;
};
