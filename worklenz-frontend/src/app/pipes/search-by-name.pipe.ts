import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'searchByName',
  standalone: true
})
export class SearchByNamePipe implements PipeTransform {
  transform<T>(items: T[], searchTerm: string | null): T[] {
    if (!searchTerm)
      return items;

    return items.filter((item: any) => {
      return item.name?.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }
}
