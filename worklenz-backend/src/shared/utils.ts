import slug from "slugify";
import moment from "moment";
import lodash from "lodash";
import sanitizeHtml from "sanitize-html";

import { customAlphabet } from "nanoid";
import { AvatarNamesMap, NumbersColorMap, WorklenzColorCodes } from "./constants";
import { send_to_slack } from "./slack";
import { IActivityLogChangeType } from "../services/activity-logs/interfaces";
import { IRecurringSchedule } from "../interfaces/recurring-tasks";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const error_codes = require("./postgresql-error-codes");

export function log_error(error: any, user: any | null = null, sendToSlack = true) {
  const msg = error_codes[error.code];
  if (msg) {
    console.log("\n==== BEGIN ERROR ====\n");
    console.trace(`ERROR [${error.code}]: ${msg}\n`);
  }

  console.log("\n");
  console.error(error);
  console.log("\n==== END ERROR ====\n");

  const err = user ? {
    user: user || null,
    error
  } : error;
  if (sendToSlack)
    send_to_slack(err);
}

/** Returns true if node env is production */
export function isProduction() {
  return process.env.NODE_ENV === "production";
}

/** Returns true if uat or dev */
export function isTestServer() {
  const hostname = process.env.HOSTNAME;
  return hostname === "dev.worklenz.com" || hostname === "uat.app.worklenz.com";
}

/** Returns true if localhost:3000 or localhost:4200 */
export function isLocalServer() {
  const allowedUrls = ["localhost:5173", "localhost:5174", "localhost:4200", "localhost:3000", "127.0.0.1:3000", "localhost:5000"];
  const frontendUrl = process.env.FRONTEND_URL;
  return allowedUrls.includes(frontendUrl || "");
}

/** Returns true of isLocal or isTest server */
export function isInternalServer() {
  return isLocalServer() || isTestServer();
}

/**
 * String value to a URL-friendly string
 * @param str {String}
 * @returns string
 */
export function slugify(str: string): string {
  return slug(str || "", {
    replacement: "-", // replace spaces with replacement
    remove: /[*+~.()'"!:@]/g, // regex to remove characters
    lower: true, // result in lower case
  });
}

export function smallId(len: number) {
  /**
   * Create nanoid instance with a specific alphabet
   * `Alphabet: 0123456789`
   * @returns e.g. 458652
   */
  return customAlphabet("0123456789", len)();
}

export function isValidateEmail(email: string) {
  const re =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

export function isValidPhoneNumber(phone: string) {
  if (!phone || phone.trim() === '') return true; // Optional field

  // Use libphonenumber-js for robust international phone validation
  try {
    const { parsePhoneNumber } = require('libphonenumber-js');
    const phoneNumber = parsePhoneNumber(phone.trim());
    return phoneNumber ? phoneNumber.isValid() : false;
  } catch (error) {
    // If parsing fails, the number is invalid
    return false;
  }
}

export function toTsQuery(value: string) {
  return `${value.replace(/\s/g, "+").replace(/\(|\)/g, "")}:*`;
}

function nextChar(c: string) {
  return String.fromCharCode(c.charCodeAt(0) + 1);
}

function numberToAlpha(num: number) {
  if (num < 1 || num > 26) {
    throw new Error("Number must be between 1 and 26.");
  }

  // Convert the number to an ASCII code by adding 64
  const asciiCode = num + 64;

  // Convert the ASCII code to the corresponding character
  return String.fromCharCode(asciiCode);
}

export function getColor(name?: string, next = false) {
  const char = name?.replace(/[^a-zA-Z0-9]/g, "").charAt(0).toUpperCase() || "A";

  const map = /\d/.test(char)
    ? NumbersColorMap
    : AvatarNamesMap;

  return map[next ? nextChar(char) || char : char];
}

export function toMinutes(hours?: number, minutes?: number) {
  return ~~((hours || 0) * 60) + (minutes || 0);
}

export function toSeconds(hours: number, minutes: number, seconds: number) {
  return (hours * 3600) + (minutes * 60) + seconds;
}

export function toMilliseconds(hours: number, minutes: number, seconds: number) {
  return ((hours * 3600) + (minutes * 60) + seconds) * 1000;
}

export function toRound(value: string | number) {
  return /\d+/.test(value as string)
    ? Math.ceil(+value)
    : 0;
}

/** Convert bytes to human-readable format (e.g. 1000 bytes - 1 kb) */
export function humanFileSize(size: number) {
  const i = size == 0 ? 0 : ~~(Math.log(size) / Math.log(1024));
  return `${(+(size / Math.pow(1024, i)).toFixed(2))} ${["B", "KB", "MB", "GB", "TB"][i]}`;
}

export function getRandomColorCode() {
  // Using bitwise is faster than Math.floor
  return WorklenzColorCodes[~~(Math.random() * WorklenzColorCodes.length)];
}

export function sanitize(value: string) {
  if (!value) return "";

  const escapedString = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

  return sanitizeHtml(escapedString);
}

/**
 * Sanitizes plain text fields (like user names) to prevent XSS attacks
 * Strips all HTML tags while preserving the text content, then escapes special characters
 * Use this for fields that should never contain HTML markup
 * 
 * @param value - The plain text to sanitize
 * @returns Sanitized plain text with HTML removed and entities escaped
 */
export function sanitizePlainText(value: string): string {
  if (!value) return "";

  // First strip all HTML tags using sanitize-html
  // This converts "<script>alert(1)</script>Hello" to "alert(1)Hello"
  // and "><img src=x onerror=alert()>" to ""
  const stripped = sanitizeHtml(value, {
    allowedTags: [],        // No HTML tags allowed
    allowedAttributes: {},  // No attributes allowed
  });

  // Then escape HTML special characters for extra safety
  // This prevents any remaining special chars from being interpreted as HTML
  // Note: We trim after escaping to preserve intentional spaces
  return stripped
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}

/**
 * Sanitizes SVG/XML content to prevent XSS attacks via embedded scripts
 * Removes all script tags, event handlers, and dangerous elements from SVG files
 * Use this before storing SVG file content to prevent XSS via SVG upload
 * 
 * @param svgContent - The SVG/XML content to sanitize
 * @returns Sanitized SVG content safe for storage and display
 */
export function sanitizeSVG(svgContent: string): string {
  if (!svgContent) return "";

  // Use sanitize-html with strict SVG-safe configuration
  return sanitizeHtml(svgContent, {
    // Allow only safe SVG elements
    allowedTags: [
      'svg', 'g', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon',
      'ellipse', 'text', 'tspan', 'defs', 'linearGradient', 'radialGradient',
      'stop', 'use', 'symbol', 'clipPath', 'mask', 'pattern', 'image',
      'foreignObject', 'marker', 'animate', 'animateTransform'
    ],
    // Allow only safe SVG attributes (no event handlers)
    allowedAttributes: {
      'svg': ['xmlns', 'viewBox', 'width', 'height', 'preserveAspectRatio', 'version'],
      'g': ['id', 'transform', 'fill', 'stroke', 'stroke-width', 'opacity'],
      'path': ['id', 'd', 'fill', 'stroke', 'stroke-width', 'transform', 'opacity'],
      'circle': ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width', 'transform', 'opacity'],
      'rect': ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke', 'stroke-width', 'transform', 'opacity'],
      'line': ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width', 'transform'],
      'polyline': ['points', 'fill', 'stroke', 'stroke-width', 'transform'],
      'polygon': ['points', 'fill', 'stroke', 'stroke-width', 'transform'],
      'ellipse': ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke', 'stroke-width', 'transform', 'opacity'],
      'text': ['x', 'y', 'font-size', 'font-family', 'fill', 'text-anchor', 'transform'],
      'tspan': ['x', 'y', 'dx', 'dy', 'font-size', 'font-family', 'fill'],
      'linearGradient': ['id', 'x1', 'y1', 'x2', 'y2', 'gradientUnits'],
      'radialGradient': ['id', 'cx', 'cy', 'r', 'fx', 'fy', 'gradientUnits'],
      'stop': ['offset', 'stop-color', 'stop-opacity'],
      'use': ['href', 'xlink:href', 'x', 'y', 'width', 'height'],
      'image': ['href', 'xlink:href', 'x', 'y', 'width', 'height'],
      'clipPath': ['id'],
      'mask': ['id'],
      'pattern': ['id', 'x', 'y', 'width', 'height', 'patternUnits'],
      'marker': ['id', 'markerWidth', 'markerHeight', 'refX', 'refY', 'orient'],
      'animate': ['attributeName', 'from', 'to', 'dur', 'repeatCount'],
      'animateTransform': ['attributeName', 'type', 'from', 'to', 'dur', 'repeatCount']
    },
    // No javascript: or data: URLs
    allowedSchemes: ['http', 'https'],
    // Disallow script tags and event handlers
    allowedScriptHostnames: [],
    allowedScriptDomains: [],
    // Explicitly disallow script and other dangerous tags
    disallowedTagsMode: 'discard',
    // Remove all event handler attributes
    allowedIframeHostnames: [],
    // Parse as XML to preserve SVG structure
    parser: {
      lowerCaseTags: false,
      lowerCaseAttributeNames: false
    }
  });
}

/**
 * Sanitizes task comment content to prevent XSS attacks and open redirects
 * Allows safe HTML tags for mentions and basic formatting while blocking dangerous content
 * External links are completely removed to prevent open redirect attacks
 * 
 * @param content - The comment content to sanitize
 * @returns Sanitized content safe for storage and display
 */
export function sanitizeCommentContent(content: string): string {
  if (!content) return "";

  // Use sanitize-html with strict configuration
  // This allows mentions (<span class="mentions">) and basic formatting but NO external links
  return sanitizeHtml(content, {
    // Only allow safe formatting tags - NO links to prevent open redirect attacks
    allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'span'],
    allowedAttributes: {
      // Only allow class attribute on span for mentions
      'span': ['class']
    },
    // No URL schemes allowed since we're not allowing links
    allowedSchemes: [],
    // Remove dangerous protocols and event handlers
    allowedScriptHostnames: [],
    allowedScriptDomains: [],
    // Remove any script tags, event handlers, and dangerous attributes
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: true,
    // Additional security: remove all attributes except explicitly allowed ones
    allowedClasses: {
      'span': ['mentions']
    }
  });
}

export function escape(value: string) {
  return lodash.escape(sanitizeHtml(value));
}

export function unescape(value: string) {
  return lodash.unescape(value);
}

export function isUnicode(value: string) {
  for (let i = 0, n = value.length; i < n; i++) {
    if (value.charCodeAt(i) > 255) return true;
  }
  return false;
}

export function formatDuration(duration: moment.Duration) {
  const empty = "0h 0m";
  let format = "";

  if (duration.asMilliseconds() === 0) return empty;

  const h = ~~(duration.asHours());
  const m = duration.minutes();
  const s = duration.seconds();

  if (h === 0 && s > 0) {
    format = `${m}m ${s}s`;
  } else if (h > 0 && s === 0) {
    format = `${h}h ${m}m`;
  } else if (h > 0 && s > 0) {
    format = `${h}h ${m}m ${s}s`;
  } else {
    format = `${h}h ${m}m`;
  }

  return format;
}

export function calculateMonthDays(startDate: string, endDate: string): string {
  const start: Date = new Date(startDate);
  const end: Date = new Date(endDate);

  const diffInMilliseconds: number = Math.abs(end.getTime() - start.getTime());
  const days: number = Math.floor(diffInMilliseconds / (1000 * 60 * 60 * 24));
  const months: number = Math.floor(days / 30);
  const remainingDays: number = days % 30;


  return `${months} ${months > 1 ? "months" : "month"} ${remainingDays} ${remainingDays !== 1 ? "days" : "day"}`;
}

export function int<T>(value: T) {
  return isNaN(+value) ? 0 : +value;
}

export function formatLogText(log: { log_type: IActivityLogChangeType; }) {
  if (log.log_type === IActivityLogChangeType.ASSIGN) return "added an ";
  if (log.log_type === IActivityLogChangeType.UNASSIGN) return "removed an ";
  if (log.log_type === IActivityLogChangeType.UPDATE) return "updated the ";
  if (log.log_type === IActivityLogChangeType.CREATE) return "added a ";
  if (log.log_type === IActivityLogChangeType.DELETE) return "removed a ";
  return log.log_type;
}

// Calculate the next start date based on the recurring schedule
export function calculateNextEndDate(schedule: IRecurringSchedule, lastDate: moment.Moment): moment.Moment {
  const nextDate = moment(lastDate);

  switch (schedule.schedule_type) {
    case "daily":
      return nextDate.add(1, "day");
    case "weekly":
      if (schedule.days_of_week && schedule.days_of_week.length > 0) {
        let daysAdded = 0;
        do {
          nextDate.add(1, "day");
          daysAdded++;
        } while (!schedule.days_of_week.includes(nextDate.day()) && daysAdded < 7);
      } else {
        nextDate.add(1, "week");
      }
      return nextDate;
    case "monthly":
      if (schedule.date_of_month) {
        nextDate.add(1, "month").date(schedule.date_of_month);
      } else if (schedule.day_of_month && schedule.week_of_month) {
        nextDate.add(1, "month").startOf("month").day(schedule.day_of_month);
        nextDate.add(schedule.week_of_month - 1, "weeks");
      } else {
        nextDate.add(1, "month");
      }
      return nextDate;
    case "yearly":
      return nextDate.add(1, "year");
    case "every_x_days":
      return nextDate.add(schedule.interval_days || 1, "days");
    case "every_x_weeks":
      return nextDate.add(schedule.interval_weeks || 1, "weeks");
    case "every_x_months":
      return nextDate.add(schedule.interval_months || 1, "months");
    default:
      throw new Error(`Invalid schedule type: ${schedule.schedule_type}`);
  }
}


export function calculateNextEndDates(schedule: IRecurringSchedule, lastEndDate: moment.Moment, count: number): moment.Moment[] {
  const endDates: moment.Moment[] = [];
  let currentDate = moment(lastEndDate);

  for (let i = 0; i < count; i++) {
    currentDate = calculateNextEndDate(schedule, currentDate);
    endDates.push(moment(currentDate));
  }

  return endDates;
}

export function megabytesToBytes(megabytes: number): number {
  return megabytes * 1024 * 1024; // 1 MB = 1024 KB = 1024 * 1024 bytes
}

