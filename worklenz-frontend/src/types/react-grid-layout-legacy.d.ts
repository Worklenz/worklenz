/**
 * `react-grid-layout` ships real types for its `./legacy` subpath export (see
 * node_modules/react-grid-layout/dist/legacy.d.ts), but this project's tsconfig uses
 * `"moduleResolution": "node"`, which (unlike `"bundler"` or `"node16"`) does not resolve a
 * package's `exports` map for type lookups, so `tsc` cannot see them even though Vite's own
 * resolver (which does honour `exports`) loads the real module fine at build and run time. This is
 * a type-checking-only shim; only the members this codebase imports are declared.
 */
declare module 'react-grid-layout/legacy' {
  import type { ComponentType, ReactNode } from 'react';

  export type CompactType = 'vertical' | 'horizontal' | null;

  export interface Layout {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
    static?: boolean;
    isDraggable?: boolean;
    isResizable?: boolean;
  }

  export interface ResponsiveLayouts {
    [breakpoint: string]: Layout[];
  }

  export interface ResponsiveReactGridLayoutProps {
    /** Container width in pixels; normally supplied by `WidthProvider`, not passed directly. */
    width: number;
    className?: string;
    layouts: ResponsiveLayouts;
    breakpoints?: Record<string, number>;
    cols?: Record<string, number>;
    rowHeight?: number;
    margin?: readonly [number, number];
    containerPadding?: readonly [number, number] | null;
    compactType?: CompactType;
    isDraggable?: boolean;
    isResizable?: boolean;
    draggableHandle?: string;
    draggableCancel?: string;
    onBreakpointChange?: (newBreakpoint: string, newCols: number) => void;
    onLayoutChange?: (currentLayout: ReadonlyArray<Layout>, allLayouts?: ResponsiveLayouts) => void;
    children?: ReactNode;
  }

  export const Responsive: ComponentType<ResponsiveReactGridLayoutProps>;

  export interface WidthProviderProps {
    measureBeforeMount?: boolean;
    className?: string;
  }

  export function WidthProvider<P extends { width: number }>(
    ComposedComponent: ComponentType<P>
  ): ComponentType<Omit<P, 'width'> & WidthProviderProps>;
}
