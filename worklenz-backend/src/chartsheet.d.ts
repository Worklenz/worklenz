declare module "chartsheet" {
  export interface ChartSeriesSpec {
    ref: string;
    nameRef?: string;
    name?: string;
    colour?: string;
  }

  export interface ChartSpec {
    type?: "bar" | "column" | "line" | "pie" | "doughnut" | "area" | "scatter" | "radar";
    title?: string;
    sheet?: string;
    categories?: string;
    series: ChartSeriesSpec[];
    anchor?: { col: number; row: number };
    width?: number;
    height?: number;
    stacked?: boolean;
    horizontal?: boolean;
    dataLabels?: boolean;
    legend?: "r" | "l" | "t" | "b" | false;
    numberFormat?: string;
    gridlines?: boolean;
    xTitle?: string;
    yTitle?: string;
  }

  export function addChart(
    buffer: Buffer | ArrayBuffer | Uint8Array,
    spec: ChartSpec
  ): Promise<Buffer>;

  export function addCharts(
    buffer: Buffer | ArrayBuffer | Uint8Array,
    specs: ChartSpec[]
  ): Promise<Buffer>;

  export function captureCharts(buffer: Buffer | ArrayBuffer | Uint8Array): Promise<unknown>;

  export function chartCount(record: unknown): number;
}
