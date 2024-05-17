import {ChangeDetectorRef, Directive, ElementRef, EventEmitter, HostListener, Output, Renderer2} from '@angular/core';
import {IDragReturn} from "@interfaces/workload";
import {RoadmapV2Service} from "../services/roadmap-v2-service.service";

@Directive({
  selector: '[worklenzDragAndMove]'
})

export class DragAndMoveDirective {

  @Output() dragged: EventEmitter<IDragReturn> = new EventEmitter<IDragReturn>();

  private isResizing = false;
  private isDragging = false;
  private startX = 0;
  private initialLeft = 0;

  finalLeft: number | null = null;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
    private readonly service: RoadmapV2Service,
    private readonly cdr: ChangeDetectorRef
  ) {
  }

  throttle(func: any, delay: any) {
    let timer: any;
    return function (...args: any) {
      if (!timer) {
        func.apply(DragAndMoveDirective, args);
        timer = setTimeout(() => {
          timer = null;
        }, delay);
      }
    };
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    const targetClassList = (event.target as HTMLElement).classList;
    if (targetClassList.contains('resize-handle')) {
      this.isResizing = true;
    } else {
      this.isDragging = true;
    }

    this.startX = event.clientX;
    this.initialLeft = Math.floor(this.el.nativeElement.id);

    // create temp placeholder
    this.setPlaceHolderStyles();

    // set highlighter style
    this.service.highlighterLeft = this.el.nativeElement.offsetLeft;
    this.service.highlighterWidth = this.el.nativeElement.offsetWidth;

    // set styles for element
    this.renderer.setStyle(this.el.nativeElement, 'opacity', '0');
    this.renderer.setStyle(this.el.nativeElement, 'transform', `translateX(${Math.floor(this.initialLeft)}px)`);
    this.renderer.setStyle(this.el.nativeElement, 'left', '0');
    this.renderer.setStyle(this.el.nativeElement, 'z-index', '1');

    // remove temp placeholder
    this.removePlaceHolderStyles();

    document.body.style.userSelect = 'none';
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.isResizing || !this.isDragging) {
      return;
    }
    this.service.transition = 0.15;
    const throttledMouseMove = this.throttle(() => {
      requestAnimationFrame(() => {
        this.renderer.setStyle(this.el.nativeElement, 'transform', `translateX(${Math.floor((this.initialLeft + event.clientX - this.startX) / 35) * 35}px)`);
      });
      this.finalLeft = Math.floor((this.initialLeft + event.clientX - this.startX) / 35) * 35;
      this.service.highlighterLeft = this.finalLeft
    }, 200);
    throttledMouseMove();
  }

  @HostListener('document:mouseup')
  onMouseUp(event: MouseEvent): void {
    if (this.isResizing || this.isDragging) {
      this.isResizing = false;
      this.isDragging = false;
      document.body.style.userSelect = 'auto';
      let finalLeft = this.finalLeft ? this.finalLeft : this.initialLeft;

      this.setPlaceHolderStyles();

      this.renderer.setStyle(this.el.nativeElement, 'opacity', '0');
      this.renderer.setStyle(this.el.nativeElement, 'transform', `translateX(0px)`);
      this.renderer.setStyle(this.el.nativeElement, 'left', `${finalLeft}px`);
      this.renderer.setStyle(this.el.nativeElement, 'z-index', '0');

      this.removePlaceHolderStyles();

      let dragDifference = finalLeft - this.initialLeft;

      const body: IDragReturn = {finalLeft, dragDifference}

      this.dragged.emit(body);

      dragDifference = 0;
      this.finalLeft = null;
      this.initialLeft = 0;
    }
  }

  private setPlaceHolderStyles() {
    this.showIndicators();
    this.service.transition = 0;
    this.service.width = this.el.nativeElement.offsetWidth;
    this.service.top = this.el.nativeElement.offsetTop;
    this.service.left = this.el.nativeElement.offsetLeft;
    this.service.opacity = 1;
    this.cdr.markForCheck();
  }

  private removePlaceHolderStyles() {
    this.service.opacity = 0;
    this.renderer.setStyle(this.el.nativeElement, 'opacity', '1');
    this.service.width = 0;
    this.service.left = 0;
  }

  private showIndicators() {
    this.service.emitShowIndicators(this.el.nativeElement.getAttribute('task_id'))
  }


}
