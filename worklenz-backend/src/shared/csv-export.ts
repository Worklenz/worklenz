import { escapeCsvValue, sanitizeCsvFormulaValue } from "./csv-utils";

export function sanitizeCsvValue(value: unknown): string {
  return escapeCsvValue(sanitizeCsvFormulaValue(String(value ?? "")));
}
