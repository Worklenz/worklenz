import { IChartPoint } from "./interfaces";

export default class PointOptionsObject implements IChartPoint {
  name!: string;
  color!: string;
  y!: number;

  constructor(name: string, color: string, y: number) {
    this.name = name;
    this.color = color;
    this.y = y;
  }
}
