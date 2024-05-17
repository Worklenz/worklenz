import {EMAIL_REGEXP} from "@shared/constants";
import moment from "moment/moment";

export const getLetters = (str: { split: (arg0: string) => any[][]; }) => {
  return str
    .split(' ')
    .map((word: any[]) => word[0])
    .join('');
};

export function toQueryString(obj: any) {
  const query = [];
  for (const key in obj) {
    if (typeof obj[key] !== undefined && obj[key] !== null) {
      query.push(`${key}=${obj[key]}`);
    }
  }
  return "?" + query.join("&");
}

const IconsMap: { [x: string]: string; } = {
  ai: "ai.png",
  avi: "avi.png",
  css: "css.png",
  csv: "csv.png",
  doc: "doc.png",
  docx: "doc.png",
  exe: "exe.png",
  html: "html.png",
  js: "js.png",
  jpg: "jpg.png",
  jpeg: "jpg.png",
  json: "json.png",
  mp3: "mp3.png",
  mp4: "mp4.png",
  pdf: "pdf.png",
  png: "png.png",
  ppt: "ppt.png",
  psd: "psd.png",
  search: "search.png",
  svg: "svg.png",
  txt: "txt.png",
  xls: "xls.png",
  xml: "xml.png",
  zip: "zip.png",
}

export function getFileIcon(type?: string) {
  return IconsMap[type as string] || IconsMap["search"];
}

export const getBase64 = (file: File): Promise<string | ArrayBuffer | null> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

export function log_error(error: any) {
  console.error("Worklenz Error: ", error);
}

export function isValidateEmail(email: string) {
  return EMAIL_REGEXP.test(String(email).toLowerCase());
}

export function smallId(length: number) {
  // Generate a random number
  const l = Array.from(Array(length).keys()).fill(0).join('');
  const size = +`1${l}`;
  let number = ~~(Math.random() * size);
  let string = "";
  // Convert the number to base-26 representation
  while (number > 0) {
    const digit = number % 26;
    string = String.fromCharCode(65 + digit) + string;
    number = ~~(number / 26);
  }
  // Add a check digit to the end
  const sum = string.split("").map(char => char.charCodeAt(0) - 65).reduce((a, b) => a + b);
  const checkDigit = sum % 26;
  return string + String.fromCharCode(65 + checkDigit);
}

export function deepClone<T>(obj: T): T {
  if (typeof window.structuredClone !== "undefined")
    return structuredClone(obj);

  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    return obj;
  }
}

export function calculateTaskCompleteRatio(totalCompleted: number, totalTasks: number) {
  if (totalCompleted === 0 && totalTasks === 0) return 0;
  const ratio = ((totalCompleted / totalTasks) * 100);
  return ratio == Infinity ? 100 : +ratio.toFixed();
}

/**
 * @param seconds default 200ms
 */
export function waitForSeconds(seconds = 200): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      return resolve();
    }, seconds);
  });
}

// export const formatGanttDate = (date: moment.MomentInput) => date ? moment(date).format("YYYY-MM-DDT00:00:00Z") : null;
export const formatGanttDate = (date: any) => date ? date : null;

export function formatGanttEndDate(date: moment.MomentInput) {
  const timeZoneOffset = new Date().getTimezoneOffset();
  return date ? moment(date).add(timeZoneOffset, "minutes").format("YYYY-MM-DDT00:00:00Z") : null;
}
