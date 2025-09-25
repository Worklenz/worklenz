export interface GoogleUser {
  provider: string,
  sub: string,
  id: string,
  displayName: string,
  name: {
    givenName: string,
    familyName: string
  },
  given_name: string,
  family_name: string,
  email_verified: boolean,
  verified: boolean,
  language: string,
  email: string,
  emails: Array<{ value?: string; type?: string; }>,
  gender: string,
  photos: Array<{ value?: string; type?: string; }>,
  picture: string,
  _raw: string,
  _json: {
    sub: string,
    name: string,
    given_name: string,
    family_name: string,
    profile: string,
    picture: string,
    email: string,
    email_verified: boolean,
    gender: string,
    locale: string,
    hd: string,
    domain: string
  }
}

// Express request user augmentation to include our session shape
declare global {
  namespace Express {
    interface User {
      id?: string;
      email?: string;
      name?: string;
      owner?: boolean;
      team_id?: string;
      team_member_id?: string;
      team_name?: string;
      is_admin?: boolean;
      is_member?: boolean;
      is_google?: boolean;
      build_v?: string;
      timezone?: string;
      timezone_name?: string;
      socket_id?: string;
      is_expired?: boolean;
      owner_id?: string;
      subscription_status?: string;
    }
  }
}

export {};