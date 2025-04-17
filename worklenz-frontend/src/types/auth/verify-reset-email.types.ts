export interface IUpdatePasswordRequest {
  password?: string;
  user?: string;
  hash?: string;
  confirmPassword?: string;
}
