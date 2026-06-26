declare module 'lodash-es/debounce' {
  import type { DebouncedFunc, DebounceSettings } from 'lodash';

  export default function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait?: number,
    options?: DebounceSettings
  ): DebouncedFunc<T>;
}
