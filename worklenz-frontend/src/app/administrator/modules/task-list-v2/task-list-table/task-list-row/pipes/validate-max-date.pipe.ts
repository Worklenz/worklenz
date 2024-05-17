import {Pipe, PipeTransform} from '@angular/core';
import {UtilsService} from "@services/utils.service";

@Pipe({
  name: 'validateMaxDate'
})
export class ValidateMaxDatePipe implements PipeTransform {
  constructor(
    private readonly utils: UtilsService
  ) {
  }

  transform(value?: string, ...args: unknown[]) {
    return this.utils.checkForMaxDate(value);
  }
}
