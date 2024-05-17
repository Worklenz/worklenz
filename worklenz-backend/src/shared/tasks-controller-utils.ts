import moment, {max, min} from "moment";
import db from "../config/db";
import {IGanttDateRange, IGanttWeekRange} from "../interfaces/gantt-chart";

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function isWeekend(date: Date) {
  return date.getDay() == 0 || date.getDay() == 6;
}

export function isSunday(date: Date) {
  return date.getDay() == 0;
}

export function isLastDayOfWeek(date: Date) {
  return isSunday(new Date(date));
}

export function isToday(date: Date) {
  return moment().isSame(moment(date).format("YYYY-MM-DD"), "day");
}

export async function getDates(startDate = "", endDate = "") {
  let datesToAdd = 21;
  const currentDuration = moment(endDate).diff(moment(startDate), "days");
  if (currentDuration < 100) datesToAdd = 100 - currentDuration;

  const start = moment(startDate).subtract("1", "day").format("YYYY-MM-DD");
  const end = moment(endDate).add(datesToAdd, "days").format("YYYY-MM-DD");

  let dates: IGanttDateRange[] = [];
  const theDate = new Date(start);

  while (theDate < new Date(end)) {
    const data: IGanttDateRange = {
      isSunday: isSunday(theDate),
      isToday: isToday(theDate),
      isWeekend: isWeekend(theDate),
      isLastDayOfWeek: isLastDayOfWeek(theDate),
      date: new Date(theDate)
    };
    dates = [...dates, data];
    theDate.setDate(theDate.getDate() + 1);
  }

  dates.splice(-1);
  return dates;
}

export async function getWeekRange(dates: IGanttDateRange[]) {
  const weekData: IGanttWeekRange[] = [];
  const weeks: number[] = [];

  for (const [index, element] of dates.entries()) {
    const weekIndex = moment(element.date).week();

    if (!weeks.includes(weekIndex)) {
      const d: any = {};
      const monthData: string[] = [];
      d.week_index = weekIndex;
      d.days_of_week = dates.filter(e => {
        return moment(e.date).week() === moment(element.date).week();
      });
      for (const item of d.days_of_week) {
        const monthIndex = moment(item.date).month();
        if (!monthData.includes(monthNames[monthIndex])) monthData.push(monthNames[monthIndex]);
      }
      d.month_name = monthData.join(" - ");
      d.min = dates.findIndex(e => e.date?.valueOf() === min(d.days_of_week.map((days: any) => moment(days.date))).valueOf());
      d.min = index !== 0 ? d.min + 2 : d.min + 1;
      d.max = dates.findIndex(e => e.date?.valueOf() === max(d.days_of_week.map((days: any) => moment(days.date))).valueOf()) + 3;

      weeks.push(weekIndex);
      weekData.push(d);
    }
  }
  return weekData;
}

export async function getMonthRange(dates: any[]) {
  const monthData = [];
  const months: any[] = [];
  for (const [, date] of dates.entries()) {
    const monthIndex = moment(date.date).month();
    if (!months.includes(monthIndex)) {
      const d: any = {};
      d.month_name = monthNames[monthIndex];
      d.month_index = monthIndex;
      d.days_of_month = dates.filter(e => {
        return moment(e.date).month() === moment(date.date).month();
      });
      d.min = dates.findIndex(e => e.date.valueOf() === min(d.days_of_month.map((days: any) => moment(days.date))).valueOf()) + 1;
      d.max = dates.findIndex(e => e.date.valueOf() === max(d.days_of_month.map((days: any) => moment(days.date))).valueOf()) + 2;

      months.push(monthIndex);
      monthData.push(d);
    }
  }
  return monthData;
}

export async function getMinMaxOfTaskDates(projectId: string) {
  const q = `SELECT MIN(start_date) as min_date, MAX(end_date) as max_date
        FROM tasks
        WHERE project_id = $1;`;
  const result = await db.query(q, [projectId]);
  const [data] = result.rows;

  if (!data.min_date) {
    const minDateQ = `SELECT MIN(created_at) as min_date
        FROM tasks
        WHERE project_id = $1;`;
    const q1Result = await db.query(minDateQ, [projectId]);
    const [dataMinDate] = q1Result.rows;
    data.min_date = dataMinDate?.min_date;
  }
  if (!data.max_date) {
    const maxDateQ = `SELECT MAX(created_at) as max_date
        FROM tasks
        WHERE project_id = $1;`;
    const q1Result = await db.query(maxDateQ, [projectId]);
    const [dataMaxDate] = q1Result.rows;
    data.max_date = dataMaxDate?.max_date;
  }
  return data;
}

export async function getDatesForResourceAllocation(startDate = "", endDate = "") {
  const end = moment(endDate).add(4, "weeks").format("YYYY-MM-DD");

  let dates: IGanttDateRange[] = [];
  const theDate = new Date(startDate);

  while (theDate < new Date(end)) {
    const data: IGanttDateRange = {
      isSunday: isSunday(theDate),
      isToday: isToday(theDate),
      isWeekend: isWeekend(theDate),
      isLastDayOfWeek: isLastDayOfWeek(theDate),
      date: new Date(theDate)
    };
    dates = [...dates, data];
    theDate.setDate(theDate.getDate() + 1);
  }

  return dates;
}
