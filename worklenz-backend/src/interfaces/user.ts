export interface IUser {
  id?: string;
  name?: string;
  password?: string;
  email?: string;
  account_status?: "pending" | "approved" | "rejected";
}
