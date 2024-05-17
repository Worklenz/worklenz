export class ServerResponse<T> {
  public done: boolean;
  public body: T | null;
  public title: string | null = null;
  public message: string | null;

  constructor(done: boolean, body: T, message: string | null = null) {
    this.done = !!done;
    this.body = body === null || body === undefined ? null : body;
    this.message = message?.toString().trim() ?? null;
  }

  public withTitle(title: string) {
    this.title = title;
    return this;
  }

  public setMessage(message: string) {
    this.message = message;
    return this;
  }
}
