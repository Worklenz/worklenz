import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  TemplateRef,
  ViewChild
} from '@angular/core';
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";
import {NzNotificationRef, NzNotificationService} from "ng-zorro-antd/notification";
import {Subject, takeUntil} from "rxjs";
import {SocketService} from "@services/socket.service";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-project-view-extra',
  templateUrl: './project-view-extra.component.html',
  styleUrls: ['./project-view-extra.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectViewExtraComponent implements OnInit, OnDestroy {
  @ViewChild("updatesTemplate", {static: false}) updatesTemplate!: TemplateRef<any>;
  @ViewChild("projectManagerUpdateTemplate", {static: false}) projectManagerUpdateTemplate!: TemplateRef<any>;

  @Input() refreshing = false;
  @Input() projectId: string | null = null;
  @Output() refresh = new EventEmitter();
  @Output() refreshAll = new EventEmitter();

  private readonly JOIN_TXT = "join";
  private readonly LEAVE_TXT = "leave";

  readonly UPDATES_MESSAGE = 'Other members have made updates to the project. Would you like to apply them?';

  private notificationRef: NzNotificationRef | null = null;

  members = [];

  disconnected = false;
  updatesAvailable = false;
  PDUpdateAvailable = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly socket: Socket,
    private readonly socketService: SocketService,
    private readonly notification: NzNotificationService,
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone,
    private readonly auth: AuthService
  ) {
    this.socketService.onSocketLoginSuccess$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.emitJoinOrLeave(this.JOIN_TXT);
      });

    this.socketService.onSocketDisconnect$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.disconnected = true;
        this.cdr.detectChanges();
      });

    this.socketService.onSocketConnect$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.disconnected) return;
        this.disconnected = false;
        this.emitJoinOrLeave(this.JOIN_TXT);
        this.cdr.detectChanges();
      });
  }

  ngOnInit() {
    this.emitJoinOrLeave(this.JOIN_TXT);
    this.socket.on(SocketEvents.JOIN_OR_LEAVE_PROJECT_ROOM.toString(), this.handleMembersView);
    this.socket.on(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(), this.handleProjectUpdates);
    this.socket.on(SocketEvents.PROJECT_DATA_CHANGE.toString(), this.handleProjectDataChange);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.emitJoinOrLeave(this.LEAVE_TXT);
    this.socket.removeListener(SocketEvents.JOIN_OR_LEAVE_PROJECT_ROOM.toString(), this.handleMembersView);
    this.socket.removeListener(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(), this.handleProjectUpdates);
    this.socket.removeListener(SocketEvents.PROJECT_DATA_CHANGE.toString(), this.handleProjectDataChange);
  }

  private emitJoinOrLeave(type: string) {
    this.socket.emit(SocketEvents.JOIN_OR_LEAVE_PROJECT_ROOM.toString(), {type, id: this.projectId});
  }

  @HostListener("document:visibilitychange")
  private onFocusChange() {
    this.ngZone.runOutsideAngular(() => {
      if (document.visibilityState === "visible") {
        this.emitJoinOrLeave(this.JOIN_TXT);
      } else {
        this.emitJoinOrLeave(this.LEAVE_TXT);
      }
    });
  }

  private handleMembersView = (res: any) => {
    this.members = res;
    this.cdr.detectChanges();
  };

  private handleProjectUpdates = () => {
    this.updatesAvailable = true;
    if (!this.notificationRef) {
      this.notificationRef = this.notification.template(this.updatesTemplate, {
        nzDuration: -1
      });

      this.notificationRef.onClose.subscribe(() => {
        this.notificationRef = null;
      });
    }

    this.cdr.detectChanges();
  };

  handleProjectDataChange = (value: { user_id: string }) => {

    this.PDUpdateAvailable = true;
    // if (this.auth.getCurrentSession()?.id === value.user_id) return;
    if (!this.notificationRef) {
      this.notificationRef = this.notification.template(this.projectManagerUpdateTemplate, {
        nzDuration: -1
      });

      this.notificationRef.onClose.subscribe(() => {
        this.notificationRef = null;
      });
    }

    this.cdr.detectChanges();
  }

  applyUpdates() {
    this.updatesAvailable = false;
    this.cdr.detectChanges();
    setTimeout(() => {
      if (this.PDUpdateAvailable) {
        this.applyPMUpdate();
      }
      this.refresh.emit();
    });
  }

  applyPMUpdate() {
    this.PDUpdateAvailable = false;
    this.updatesAvailable = false;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.refreshAll.emit();
    });
  }

}
