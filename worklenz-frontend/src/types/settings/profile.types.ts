export interface IProfileSettings {
  id?: string;
  name?: string;
  email?: string;
  updated_at?: string;
}

/** Result of asking the server whether the AppSumo promo popup may be shown right now. */
export interface IAppSumoPopupClaim {
  should_show: boolean;
}
