import {Injectable} from '@angular/core';
import {ReplaySubject, Subject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private _socketConnectSbj$ = new Subject<void>();
  private _socketDisconnectSbj$ = new Subject<void>();
  private _socketLoginSbj$ = new ReplaySubject<void>();

  public get onSocketLoginSuccess$() {
    return this._socketLoginSbj$.asObservable();
  }

  public get onSocketConnect$() {
    return this._socketConnectSbj$.asObservable();
  }

  public get onSocketDisconnect$() {
    return this._socketDisconnectSbj$.asObservable();
  }

  public emitSocketLoginSuccess() {
    this._socketLoginSbj$.next();
  }

  public emitSocketConnect() {
    this._socketConnectSbj$.next();
  }

  public emitSocketDisconnect() {
    return this._socketDisconnectSbj$.next();
  }
}
