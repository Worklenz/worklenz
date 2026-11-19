import moment from "moment";
import Excel from "exceljs";
import HandleExceptions from "../../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { ServerResponse } from "../../../models/server-response";
import WorklenzControllerBase from "../../worklenz-controller-base";
import {
  getPortfolio,
  PORTFOLIO_PERIODS,
  PortfolioPeriod,
  PortfolioResult,
  resolvePortfolioRange,
} from "../../../services/reporting-portfolio.service";

/** Bold, tinted row with a top border so the Total row stands out in the sheet. */
const styleTotalRow = (row: Excel.Row) => {
  row.font = { bold: true };
  row.eachCell({ includeEmpty: true }, cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E6F4FF" } };
    cell.border = { top: { style: "medium" } };
  });
};

const EXPORT_TYPES = ["summary", "detailed"] as const;

const toInt = (value: unknown): number | undefined => {
  if (typeof value !== "string" || !/^\d{1,4}$/.test(value)) return undefined;
  return Number(value);
};

/** Reads period/year/quarter/month from the query and loads the portfolio, or returns an error message. */
async function loadPortfolio(req: IWorkLenzRequest): Promise<{ data: PortfolioResult } | { error: string }> {
  const period = (req.query.period as string) || "monthly";
  if (!(PORTFOLIO_PERIODS as readonly string[]).includes(period)) return { error: "Invalid period" };

  const year = toInt(req.query.year) ?? moment.utc().year();
  const range = resolvePortfolioRange({
    period: period as PortfolioPeriod,
    year,
    quarter: toInt(req.query.quarter),
    month: toInt(req.query.month),
  });
  if (!range) return { error: "Invalid reporting period" };

  const data = await getPortfolio(req.user?.team_id as string, req.user?.id as string, period as PortfolioPeriod, range);
  return { data };
}

export default class ReportingPortfolioController extends WorklenzControllerBase {
  /** GET /reporting/portfolio - KPI cards and the per-category project breakdown for one reporting period. */
  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const result = await loadPortfolio(req);
    if ("error" in result) return res.status(400).send(new ServerResponse(false, null, result.error));
    return res.status(200).send(new ServerResponse(true, result.data));
  }

  /** GET /reporting-export/portfolio?type=summary|detailed - Excel export of the same data. */
  @HandleExceptions()
  public static async export(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const type = (req.query.type as string) || "summary";
    if (!(EXPORT_TYPES as readonly string[]).includes(type)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid export type"));
    }

    const result = await loadPortfolio(req);
    if ("error" in result) return res.status(400).send(new ServerResponse(false, null, result.error));
    const { data } = result;

    const exportDate = moment().format("MMM-DD-YYYY");
    const periodLabel = moment.utc(data.range.start).format(
      data.period === "yearly" ? "YYYY" : data.period === "quarterly" ? "[Q]Q YYYY" : "MMM YYYY"
    );
    const isDetailed = type === "detailed";
    const fileName = `Project Portfolio ${isDetailed ? "Detailed" : "Summary"} - ${periodLabel.replace(/\s+/g, "-")}`;

    const workbook = new Excel.Workbook();
    const sheet = workbook.addWorksheet(isDetailed ? "Detailed" : "Summary");
    const columnLetter = (index: number) => {
      let letter = "";
      for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) letter = String.fromCharCode(65 + ((n - 1) % 26)) + letter;
      return letter;
    };
    const summaryColumnCount = 2 + data.lookups.statuses.length + 1 + data.lookups.priorities.length + data.lookups.healths.length;
    const lastColumn = columnLetter(isDetailed ? 8 : summaryColumnCount);

    sheet.getCell("A1").value = `Project Portfolio - ${periodLabel}`;
    sheet.mergeCells(`A1:${lastColumn}1`);
    sheet.getCell("A1").alignment = { horizontal: "center" };
    sheet.getCell("A1").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9D9D9" } };
    sheet.getCell("A1").font = { size: 16 };

    sheet.getCell("A2").value = `Exported on : ${exportDate}`;
    sheet.mergeCells(`A2:${lastColumn}2`);
    sheet.getCell("A2").alignment = { horizontal: "center" };
    sheet.getCell("A2").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F2F2F2" } };
    sheet.getCell("A2").font = { size: 12 };

    sheet.getCell("A3").value = `Opening: ${data.kpis.opening}   New: ${data.kpis.new}   Close: ${data.kpis.close}   Closing: ${data.kpis.closing}`;
    sheet.mergeCells(`A3:${lastColumn}3`);
    sheet.getCell("A3").alignment = { horizontal: "center" };

    if (isDetailed) {
      sheet.getRow(5).values = ["Category", "Project", "Status", "Priority", "Health", "Project Manager", "Start Date", "End Date"];
      sheet.getRow(5).font = { bold: true };
      sheet.columns = [
        { key: "category", width: 28 },
        { key: "name", width: 32 },
        { key: "status", width: 18 },
        { key: "priority", width: 14 },
        { key: "health", width: 18 },
        { key: "manager", width: 28 },
        { key: "start", width: 16 },
        { key: "end", width: 16 },
      ];
      for (const category of data.categories) {
        for (const project of category.projects) {
          sheet.addRow({
            category: category.name ?? "Uncategorized",
            name: project.name,
            status: project.status,
            priority: project.priority ?? "-",
            health: project.health ?? "-",
            manager: project.manager ?? "-",
            start: project.startDate ? moment(project.startDate).format("YYYY-MM-DD") : "-",
            end: project.endDate ? moment(project.endDate).format("YYYY-MM-DD") : "-",
          });
        }
      }
      styleTotalRow(sheet.addRow({ category: "Total", name: data.totals.total }));
    } else {
      const { statuses, priorities, healths } = data.lookups;
      const groups = [
        { title: "Project Status", names: [...statuses.map(item => item.name), "Overdue"] },
        { title: "Project Priority", names: priorities.map(item => item.name) },
        { title: "Project Health", names: healths.map(item => item.name) },
      ].filter(group => group.names.length);
      const optionCount = groups.reduce((sum, group) => sum + group.names.length, 0);
      sheet.columns = [{ width: 28 }, ...Array.from({ length: optionCount + 1 }, () => ({ width: 16 }))];

      // Row 5: group headers merged over their option columns. Row 6: the options themselves.
      sheet.getRow(5).getCell(1).value = "Project Category";
      sheet.getRow(5).getCell(2).value = "Total Projects";
      sheet.mergeCells(5, 1, 6, 1);
      sheet.mergeCells(5, 2, 6, 2);
      let column = 3;
      for (const group of groups) {
        sheet.getRow(5).getCell(column).value = group.title;
        if (group.names.length > 1) sheet.mergeCells(5, column, 5, column + group.names.length - 1);
        group.names.forEach((name, index) => (sheet.getRow(6).getCell(column + index).value = name));
        column += group.names.length;
      }
      for (const rowNumber of [5, 6]) {
        const row = sheet.getRow(rowNumber);
        row.font = { bold: true };
        for (let col = 1; col <= optionCount + 2; col++) {
          const cell = row.getCell(col);
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9D9D9" } };
          cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        }
      }
      const toRow = (label: string, c: PortfolioResult["totals"]) => [
        label,
        c.total,
        ...statuses.map(item => c.status[item.id] ?? 0),
        c.overdue,
        ...priorities.map(item => c.priority[item.id] ?? 0),
        ...healths.map(item => c.health[item.id] ?? 0),
      ];
      for (const category of data.categories) sheet.addRow(toRow(category.name ?? "Uncategorized", category));
      styleTotalRow(sheet.addRow(toRow("Total", data.totals)));
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats");
    res.setHeader("Content-Disposition", `attachment; filename=${encodeURIComponent(fileName)}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  }
}
