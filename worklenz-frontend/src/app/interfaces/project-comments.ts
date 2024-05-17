
export interface IMentionMember {
  id?: string; /*user id*/
  name?: string
}

export interface IMentionMemberViewModel extends IMentionMember{
  email?: string;
  avatar_url?: string;
  color_code?: string;
}
