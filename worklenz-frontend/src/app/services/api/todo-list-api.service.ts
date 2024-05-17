import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {lastValueFrom} from "rxjs";
import {ITodoListItem} from "@interfaces/todo-list-item";
import {toQueryString} from "@shared/utils";

@Injectable({
  providedIn: 'root'
})
export class TodoListApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/todo-list`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  create<T>(body: ITodoListItem): Promise<IServerResponse<ITodoListItem>> {
    return this._post(this.http, this.root, body);
  }

  get<T>(search: string | null, showCompleted: boolean | null = null): Promise<IServerResponse<ITodoListItem[]>> {
    const s = encodeURIComponent(search || '');
    const url = `${this.root}${toQueryString({showCompleted, search: s})}`;
    return this._get(this.http, url);
  }

  update<T>(id: string, body: ITodoListItem): Promise<IServerResponse<ITodoListItem>> {
    return this._put(this.http, `${this.root}/${id}`, body);
  }

  updateStatus<T>(id: string, body: ITodoListItem): Promise<IServerResponse<ITodoListItem>> {
    return this._put(this.http, `${this.root}/status/${id}`, body);
  }

  updateIndex<T>(from: number, to: number): Promise<IServerResponse<ITodoListItem>> {
    return this._put(this.http, `${this.root}/index`, {from, to});
  }

  delete<T>(id: string): Promise<IServerResponse<any>> {
    return lastValueFrom(this.http.delete<IServerResponse<any>>(`${this.root}/${id}`));
  }
}
