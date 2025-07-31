import * as Highcharts from "highcharts";

export default class PointOptionsObject implements Highcharts.PointOptionsObject {
  name!: string;
  color!: string;
  y!: number;

  constructor(name: string, color: string, y: number) {
    this.name = name;
    this.color = color;
    this.y = y;
  }
}
