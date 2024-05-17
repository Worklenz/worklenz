export interface IServerResponse<T> {
  done: boolean;
  title?: string;
  message?: string;
  body: T;
}
