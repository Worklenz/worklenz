import {ChangeDetectionStrategy, Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {NzTypographyModule} from "ng-zorro-antd/typography";

@Component({
  selector: 'worklenz-na',
  standalone: true,
  imports: [CommonModule, NzTypographyModule],
  templateUrl: './na.component.html',
  styleUrls: ['./na.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NaComponent {

}
