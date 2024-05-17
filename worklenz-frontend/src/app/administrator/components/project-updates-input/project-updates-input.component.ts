import {ChangeDetectionStrategy, Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzFormModule} from "ng-zorro-antd/form";
import {NzInputModule} from "ng-zorro-antd/input";
import {NzMentionModule} from "ng-zorro-antd/mention";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzWaveModule} from "ng-zorro-antd/core/wave";

@Component({
  selector: 'worklenz-project-updates-input',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzSpaceModule,
    NzWaveModule,
    ReactiveFormsModule,
    NzMentionModule
  ],
  templateUrl: './project-updates-input.component.html',
  styleUrls: ['./project-updates-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectUpdatesInputComponent {

}
