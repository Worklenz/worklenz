import {Pipe, PipeTransform} from '@angular/core';
import {UtilsService} from "@services/utils.service";

@Pipe({
  name: 'validateMinDate'
})
export class ValidateMinDatePipe implements PipeTransform {
  constructor(
    private readonly utils: UtilsService
  ) {
  }

  transform(value?: string, ...args: unknown[]) {
    return this.utils.checkForMinDate(value);
  }
}
