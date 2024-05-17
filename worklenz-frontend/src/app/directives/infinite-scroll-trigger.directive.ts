import {Directive, ElementRef, Input} from '@angular/core';
import {filter, ReplaySubject, Subscription} from "rxjs";
import {InfiniteScrollDirective} from "ngx-infinite-scroll";

@Directive({
  selector: '[infiniteScrollTrigger]',
  standalone: true
})
export class InfiniteScrollTriggerDirective {
  @Input() set items(items: any[]) {
    this.items$.next(items);
  }

  items$ = new ReplaySubject<any[]>(1); // so new subscribers won't "miss" the previous value
  itemSub!: Subscription; // so we can unsubscribe later!

  constructor(
    private elementRef: ElementRef,
    private infiniteScroll: InfiniteScrollDirective
  ) {
  }

  ngOnInit() {
    this.itemSub = this.items$
      .asObservable()
      .pipe(
        // ignore until we've loaded some items
        filter((items) => !!items && items.length > 0),
        // wait for container to re-render the new items list
        // delay(1)
      )
      .subscribe(() => this.doOverflowCheck());
  }

  ngOnDestroy() {
    // Don't forget to unsubscribe!
    this.itemSub.unsubscribe();
  }

  containerDoesNotOverflow(): boolean {
    // The element property is private... don't make this a habit.
    const container = this.resolveContainerElement(
      this.infiniteScroll.infiniteScrollContainer,
      this.infiniteScroll.scrollWindow,
      this.elementRef.nativeElement,
      this.infiniteScroll.scrollWindow
    );

    if (!container) {
      return false;
    }

    // The infiniteScroll directive allows horizontal scrolling
    // If true, check if the container overflows horizontally
    if (this.infiniteScroll.horizontal) {
      return container.clientWidth === container.scrollWidth;
    }

    return container.clientHeight === container.scrollHeight;
  }

  doOverflowCheck(): void {
    if (this.containerDoesNotOverflow()) {
      this.infiniteScroll.scrolled.emit();
    }
  }

  private resolveContainerElement(
    selector: string | any,
    scrollWindow: any,
    defaultElement: any,
    fromRoot: boolean
  ): any {
    const hasWindow =
      window && !!window.document && window.document.documentElement;
    let container = hasWindow && scrollWindow ? window : defaultElement;
    if (selector) {
      const containerIsString =
        selector && hasWindow && typeof selector === 'string';
      container = containerIsString
        ? this.findElement(selector, defaultElement.nativeElement, fromRoot)
        : selector;
      if (!container) {
        throw new Error(
          'ngx-infinite-scroll {resolveContainerElement()}: selector for'
        );
      }
    }
    return container;
  }

  private findElement(
    selector: string | any,
    customRoot: ElementRef | any,
    fromRoot: boolean
  ) {
    const rootEl = fromRoot ? window.document : customRoot;
    return rootEl.querySelector(selector);
  }
}
