import {lastValueFrom} from "rxjs";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";

export abstract class APIServiceBase {
  protected readonly API_BASE_URL = "/api/v1";
  protected readonly AUTH_API_BASE_URL = "/secure";

  protected _post<T>(http: HttpClient, url: string, data?: any, options?: any): Promise<IServerResponse<T>> | any {
    return lastValueFrom(http.post<IServerResponse<T>>(url, data || null, options));
  }

  protected _get<T>(http: HttpClient, url: string): Promise<IServerResponse<T>> {
    return lastValueFrom(http.get<IServerResponse<T>>(url));
  }

  protected _put<T>(http: HttpClient, url: string, data?: any): Promise<IServerResponse<T>> {
    return lastValueFrom(http.put<IServerResponse<T>>(url, data || null));
  }

  protected _delete<T>(http: HttpClient, url: string): Promise<IServerResponse<T>> {
    return lastValueFrom(http.delete<IServerResponse<T>>(url));
  }
}
