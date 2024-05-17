import {Injectable} from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import {catchError, map, throwError} from 'rxjs';

import {AppService} from "@services/app.service";

export class HttpError {
  static BadRequest = 400;
  static Unauthorized = 401;
  static Forbidden = 403;
  static NotFound = 404;
  static TimeOut = 408;
  static Conflict = 409;
  static InternalServerError = 500;
}

@Injectable()
export class HTTPInterceptor implements HttpInterceptor {
  constructor(
    private app: AppService
  ) {
  }

  intercept(request: HttpRequest<unknown>, next: HttpHandler) {
    return next.handle(request).pipe(
      map((event: HttpEvent<any>) => {
        if (event instanceof HttpResponse) {
          if (event.body) {
            if (event.body.message) {
              if (event.body.message.charAt(0) !== "$")
                this.app.notify(event.body.title || "", event.body.message, event.body.done);
            } else if (event.body.auth_error) {
              this.app.notify(event.body.title, event.body.auth_error, false);
            }
          }
        }
        return event;
      }),
      catchError((error: HttpErrorResponse) => {
        this.showError(error.status, error.error?.message || '');
        return throwError(() => error);
      })
    );
  }

  private showError(status: number, message = '') {
    switch (status) {
      case HttpError.BadRequest:
        this.app.notify('Bad Request 400', message, false);
        break;

      case HttpError.Unauthorized:
        this.app.notify('Unauthorized 401', message, false);
        break;

      case HttpError.NotFound:
        this.app.notify('Not Found 404', message, false);
        break;

      case HttpError.TimeOut:
        this.app.notify('TimeOut 408', message, false);
        break;

      case HttpError.Forbidden:
        this.app.notify('Forbidden 403', message, false);
        break;

      case HttpError.InternalServerError:
        this.app.notify('Internal Server Error 500', message, false);
        break;
    }
  }
}
