export interface PgSessionData {
  cookie: {
    originalMaxAge: number;
    expires: string;
    httpOnly: boolean;
    path: string;
  };
  flash: object;
  passport?: {
    user: string;
  };
}
