import {Pipe, PipeTransform} from '@angular/core';
import {UtilsService} from "@services/utils.service";

@Pipe({
  name: 'minDateValidator',
  standalone: true
})
export class MinDateValidatorPipe implements PipeTransform {
  constructor(
    private readonly utils: UtilsService
  ) {
  }

  transform(value?: string, ...args: unknown[]) {
    return this.utils.checkForMinDate(value);
  }
}
