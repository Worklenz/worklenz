import {Component} from '@angular/core';
import {NzResultModule} from "ng-zorro-antd/result";
import {RouterLink} from "@angular/router";
import {NzButtonModule} from "ng-zorro-antd/button";

@Component({
  selector: 'worklenz-not-authorized',
  templateUrl: './not-authorized.component.html',
  styleUrls: ['./not-authorized.component.scss'],
  imports: [
    NzResultModule,
    RouterLink,
    NzButtonModule
  ],
  standalone: true
})
export class NotAuthorizedComponent {

}
