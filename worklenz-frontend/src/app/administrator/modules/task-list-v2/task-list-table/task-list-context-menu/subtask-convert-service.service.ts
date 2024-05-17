import {Injectable} from '@angular/core';
import {Subject} from "rxjs";
import {ISubtaskConvertRequest} from './interfaces/convert-subtask-request';


@Injectable({
  providedIn: 'root'
})
export class SubtaskConvertService {
  private readonly convertSbj$ = new Subject<ISubtaskConvertRequest>();

  get onConvertingSubtask() {
    return this.convertSbj$.asObservable();
  }

  emitConvertingToSubTask(data: ISubtaskConvertRequest) {
    this.convertSbj$.next(data);
  }
}
