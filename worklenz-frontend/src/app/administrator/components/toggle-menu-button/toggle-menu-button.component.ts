import {Component, Input} from '@angular/core';
import {MenuService} from "@services/menu.service";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzIconModule} from "ng-zorro-antd/icon";

@Component({
  selector: 'worklenz-toggle-menu-button',
  templateUrl: './toggle-menu-button.component.html',
  styleUrls: ['./toggle-menu-button.component.scss'],
  imports: [
    NzToolTipModule,
    NzButtonModule,
    NzIconModule
  ],
  standalone: true
})
export class ToggleMenuButtonComponent {
  @Input() key!: string;

  constructor(
    public menu: MenuService
  ) {
  }
}
