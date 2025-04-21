export interface IMentionMember {
  id?: string /*user id*/;
  name?: string;
  team_member_id?: string;
}

export interface IMentionMemberViewModel extends IMentionMember {
  email?: string;
  avatar_url?: string;
  color_code?: string;
}

export interface IMentionMemberSelectOption {
  key: string;
  value: string;
  label: string;
}

export interface IProjectCommentsCreateRequest {
  project_id?: string;
  project_name?: string;
  team_id?: string;
  team_name?: string;
  content?: string;
  mentions?: IMentionMember[];
}
