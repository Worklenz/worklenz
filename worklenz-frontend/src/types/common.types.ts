export interface IServerResponse<T> {
  data: any;
  done: boolean;
  title?: string;
  message?: string;
  body: T;
}
