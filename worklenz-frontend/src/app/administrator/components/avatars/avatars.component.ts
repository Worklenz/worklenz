import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {NgForOf, NgSwitch, NgSwitchCase, NgTemplateOutlet} from "@angular/common";
import {NzAvatarModule} from "ng-zorro-antd/avatar";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";

import {InlineMember} from "@interfaces/api-models/inline-member";
import {FirstCharUpperPipe} from "@pipes/first-char-upper.pipe";
import {NzBadgeModule} from "ng-zorro-antd/badge";

@Component({
  selector: 'worklenz-avatars',
  templateUrl: './avatars.component.html',
  styleUrls: ['./avatars.component.scss'],
  imports: [
    NzAvatarModule,
    NzToolTipModule,
    NgForOf,
    FirstCharUpperPipe,
    NzBadgeModule,
    NgSwitch,
    NgTemplateOutlet,
    NgSwitchCase
  ],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AvatarsComponent {
  @Input() names: InlineMember[] = [];
  @Input() avatarClass: string | null = null;
  @Input() showDot = false;
}
