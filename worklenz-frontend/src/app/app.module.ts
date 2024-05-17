import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {FormsModule} from '@angular/forms';
import {ServiceWorkerModule} from '@angular/service-worker';
import {registerLocaleData} from '@angular/common';
import en from '@angular/common/locales/en';
import {HTTP_INTERCEPTORS, HttpClientModule} from '@angular/common/http';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {SocketIoConfig, SocketIoModule} from 'ngx-socket-io';

import {environment} from '../environments/environment';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {HTTPInterceptor} from './interceptors/http.interceptor';
import {NzNotificationModule} from 'ng-zorro-antd/notification';
import {NzModalModule} from "ng-zorro-antd/modal";
import {en_US, NZ_I18N} from "ng-zorro-antd/i18n";
import {NzAlertModule} from "ng-zorro-antd/alert";
import {NzTypographyModule} from "ng-zorro-antd/typography";

registerLocaleData(en);

const config: SocketIoConfig = {
  url: environment.production ? '' : 'ws://localhost:3000',
  options: {
    transports: ['websocket'],
    path: "/socket",
    upgrade: true
  }
};

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    SocketIoModule.forRoot(config),
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: environment.production,
      // Register the ServiceWorker as soon as the app is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000'
    }),
    HttpClientModule,
    NzModalModule,
    NzNotificationModule,
    AppRoutingModule,
    NzAlertModule,
    NzTypographyModule
  ],
  providers: [
    {provide: NZ_I18N, useValue: en_US},
    {
      provide: HTTP_INTERCEPTORS,
      useClass: HTTPInterceptor,
      multi: true
    }
  ],
  exports: [
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
