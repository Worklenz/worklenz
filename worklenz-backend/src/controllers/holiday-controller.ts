import Holidays from "date-holidays";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {
  ICreateHolidayRequest,
  IUpdateHolidayRequest,
  IImportCountryHolidaysRequest,
} from "../interfaces/holiday.interface";
import { log_error } from "../shared/utils";

const COUNTRY_HOLIDAY_POPULATE_START_YEAR = 2020;
const COUNTRY_HOLIDAY_POPULATE_END_YEAR = 2050;

interface DateHolidayEntry {
  type?: string;
  start?: Date | string;
  name?: string;
}

const insertPublicHolidaysForCountry = async (
  countryCode: string,
  startYear = COUNTRY_HOLIDAY_POPULATE_START_YEAR,
  endYear = COUNTRY_HOLIDAY_POPULATE_END_YEAR
): Promise<number> => {
  const hd = new Holidays();
  hd.init(countryCode);
  hd.setLanguages("en");

  let totalPopulated = 0;
  const insertQuery = `
    INSERT INTO country_holidays (country_code, name, description, date, is_recurring)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (country_code, name, date) DO NOTHING
  `;

  for (let year = startYear; year <= endYear; year++) {
    const holidays = hd.getHolidays(year) as DateHolidayEntry[];

    if (!holidays?.length) {
      continue;
    }

    const publicHolidays = holidays.filter(holiday => holiday.type === "public");

    for (const holiday of publicHolidays) {
      if (!holiday.start) {
        continue;
      }

      const date = new Date(holiday.start);
      const dateStr = date.toISOString().split("T")[0];
      const name = holiday.name || "Unknown Holiday";
      const description = holiday.type || "Public Holiday";

      await db.query(insertQuery, [countryCode, name, description, dateStr, true]);
      totalPopulated++;
    }
  }

  return totalPopulated;
};

export default class HolidayController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getHolidayTypes(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT id, name, description, color_code, created_at, updated_at
               FROM holiday_types
               ORDER BY name;`;
    const result = await db.query(q);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getOrganizationHolidays(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { year } = req.query;
    const yearFilter = year ? `AND EXTRACT(YEAR FROM oh.date) = $2` : "";
    const params = year ? [req.user?.owner_id, year] : [req.user?.owner_id];

    const q = `SELECT oh.id, oh.organization_id, oh.holiday_type_id, oh.name, oh.description, 
                      oh.date, oh.is_recurring, oh.is_auto_synced, oh.created_at, oh.updated_at,
                      ht.name as holiday_type_name, ht.color_code
               FROM organization_holidays oh
               LEFT JOIN holiday_types ht ON oh.holiday_type_id = ht.id
               WHERE oh.organization_id = (
                 SELECT id FROM organizations WHERE user_id = $1
               ) ${yearFilter}
               ORDER BY oh.date;`;
    
    const result = await db.query(q, params);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async createOrganizationHoliday(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { name, description, date, holiday_type_id, is_recurring = false }: ICreateHolidayRequest = req.body;

    const q = `INSERT INTO organization_holidays (organization_id, holiday_type_id, name, description, date, is_recurring, is_auto_synced)
               VALUES (
                 (SELECT id FROM organizations WHERE user_id = $1),
                 $2, $3, $4, $5, $6, FALSE
               )
               RETURNING id;`;
    
    const result = await db.query(q, [req.user?.owner_id, holiday_type_id, name, description, date, is_recurring]);
    return res.status(201).send(new ServerResponse(true, result.rows[0]));
  }

  @HandleExceptions()
  public static async updateOrganizationHoliday(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const { name, description, date, holiday_type_id, is_recurring }: IUpdateHolidayRequest = req.body;

    const updateFields = [];
    const values = [req.user?.owner_id, id];
    let paramIndex = 3;

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (date !== undefined) {
      updateFields.push(`date = $${paramIndex++}`);
      values.push(date);
    }
    if (holiday_type_id !== undefined) {
      updateFields.push(`holiday_type_id = $${paramIndex++}`);
      values.push(holiday_type_id);
    }
    if (is_recurring !== undefined) {
      updateFields.push(`is_recurring = $${paramIndex++}`);
      values.push(is_recurring.toString());
    }

    if (updateFields.length === 0) {
      return res.status(400).send(new ServerResponse(false, "No fields to update"));
    }

    const q = `UPDATE organization_holidays 
               SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP
               WHERE id = $2 AND organization_id = (
                 SELECT id FROM organizations WHERE user_id = $1
               )
               RETURNING id;`;
    
    const result = await db.query(q, values);
    
    if (result.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, "Holiday not found"));
    }

    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  @HandleExceptions()
  public static async deleteOrganizationHoliday(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;

    const q = `DELETE FROM organization_holidays 
               WHERE id = $2 AND organization_id = (
                 SELECT id FROM organizations WHERE user_id = $1
               )
               RETURNING id;`;
    
    const result = await db.query(q, [req.user?.owner_id, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, "Holiday not found"));
    }

    return res.status(200).send(new ServerResponse(true, { message: "Holiday deleted successfully" }));
  }

  @HandleExceptions()
  public static async getCountryHolidays(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const country_code = req.params.country_code;
    const { year } = req.query;

    if (!country_code) {
      return res.status(400).send(new ServerResponse(false, "Country code is required"));
    }

    const yearFilter = year ? `AND EXTRACT(YEAR FROM date) = $2` : "";
    const params = year ? [country_code, year] : [country_code];

    // GET stays read-only; population happens via POST /populate (populateCountryHolidays).
    const q = `SELECT id, country_code, name, description, date, is_recurring, created_at, updated_at
               FROM country_holidays
               WHERE country_code = $1 ${yearFilter}
               ORDER BY date;`;

    const result = await db.query(q, params);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getAvailableCountries(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT DISTINCT c.code, c.name
               FROM countries c
               JOIN country_holidays ch ON c.code = ch.country_code
               ORDER BY c.name;`;
    
    const result = await db.query(q);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async importCountryHolidays(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { country_code, year }: IImportCountryHolidaysRequest = req.body;
    
    if (!country_code) {
      return res.status(400).send(new ServerResponse(false, "Country code is required"));
    }

    // Get organization ID
    const orgQ = `SELECT id FROM organizations WHERE user_id = $1`;
    const orgResult = await db.query(orgQ, [req.user?.owner_id]);
    const organizationId = orgResult.rows[0]?.id;

    if (!organizationId) {
      return res.status(404).send(new ServerResponse(false, "Organization not found"));
    }

    // Get default holiday type (Public Holiday)
    const typeQ = `SELECT id FROM holiday_types WHERE name = 'Public Holiday' LIMIT 1`;
    const typeResult = await db.query(typeQ);
    const holidayTypeId = typeResult.rows[0]?.id;

    if (!holidayTypeId) {
      return res.status(404).send(new ServerResponse(false, "Default holiday type not found"));
    }

    // Get country holidays for the specified year
    const yearFilter = year ? `AND EXTRACT(YEAR FROM date) = $2` : "";
    const params = year ? [country_code, year] : [country_code];

    const holidaysQ = `SELECT name, description, date, is_recurring
                       FROM country_holidays
                       WHERE country_code = $1 ${yearFilter}`;
    
    const holidaysResult = await db.query(holidaysQ, params);

    if (holidaysResult.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, "No holidays found for this country and year"));
    }

    // Import holidays to organization
    const importQ = `INSERT INTO organization_holidays (organization_id, holiday_type_id, name, description, date, is_recurring, is_auto_synced)
                     VALUES ($1, $2, $3, $4, $5, $6, TRUE)
                     ON CONFLICT (organization_id, date) DO NOTHING`;

    let importedCount = 0;
    for (const holiday of holidaysResult.rows) {
      try {
        await db.query(importQ, [
          organizationId,
          holidayTypeId,
          holiday.name,
          holiday.description,
          holiday.date,
          holiday.is_recurring
        ]);
        importedCount++;
      } catch (error) {
        // Skip duplicates
        continue;
      }
    }

    return res.status(200).send(new ServerResponse(true, { 
      message: `Successfully imported ${importedCount} holidays`,
      imported_count: importedCount 
    }));
  }

  @HandleExceptions()
  public static async getHolidayCalendar(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { year, month } = req.query;
    
    if (!year || !month) {
      return res.status(400).send(new ServerResponse(false, "Year and month are required"));
    }

    // Use holiday settings country — organizations.country can differ and would
    // filter the wrong country_holidays rows.
    const settingsQ = `SELECT ohs.country_code
                       FROM organization_holiday_settings ohs
                       WHERE ohs.organization_id = (
                         SELECT id FROM organizations WHERE user_id = $1
                       )`;
    const settingsResult = await db.query(settingsQ, [req.user?.owner_id]);
    const countryCode = settingsResult.rows[0]?.country_code ?? null;

    // For Sri Lanka, only use country_holidays (unified source)
    // For other countries, include both organization and country holidays
    const q = countryCode === 'LK' 
      ? `SELECT ch.id, ch.name, ch.description, ch.date, ch.is_recurring,
                'Public Holiday' as holiday_type_name, '#f37070' as color_code,
                'country' as source
         FROM country_holidays ch
         WHERE ch.country_code = $4
         AND EXTRACT(YEAR FROM ch.date) = $2
         AND EXTRACT(MONTH FROM ch.date) = $3
         ORDER BY date;`
      : `SELECT oh.id, oh.name, oh.description, oh.date, oh.is_recurring,
                ht.name as holiday_type_name, ht.color_code,
                'organization' as source
         FROM organization_holidays oh
         LEFT JOIN holiday_types ht ON oh.holiday_type_id = ht.id
         WHERE oh.organization_id = (
           SELECT id FROM organizations WHERE user_id = $1
         )
         AND EXTRACT(YEAR FROM oh.date) = $2
         AND EXTRACT(MONTH FROM oh.date) = $3
         
         UNION ALL
         
         SELECT ch.id, ch.name, ch.description, ch.date, ch.is_recurring,
                'Public Holiday' as holiday_type_name, '#f37070' as color_code,
                'country' as source
         FROM country_holidays ch
         WHERE ch.country_code = $4
         AND EXTRACT(YEAR FROM ch.date) = $2
         AND EXTRACT(MONTH FROM ch.date) = $3
         ORDER BY date;`;
    
    const result = await db.query(q, [req.user?.owner_id, year, month, countryCode]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async populateCountryHolidays(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // Get the organization holiday settings to determine which country was selected
    const settingsQ = `SELECT country_code FROM organization_holiday_settings 
                       WHERE organization_id = (SELECT id FROM organizations WHERE user_id = $1)`;
    const settingsResult = await db.query(settingsQ, [req.user?.owner_id]);

    if (settingsResult.rows.length === 0 || !settingsResult.rows[0].country_code) {
      return res.status(400).send(new ServerResponse(false, "No country selected in holiday settings"));
    }

    const countryCode = settingsResult.rows[0].country_code as string;

    // Check if holidays already exist for this country
    const existingQ = `SELECT COUNT(*) as count FROM country_holidays WHERE country_code = $1`;
    const existingResult = await db.query(existingQ, [countryCode]);
    const existingCount = parseInt(existingResult.rows[0]?.count || "0", 10);

    // If holidays already exist, skip population
    if (existingCount > 0) {
      return res.status(200).send(new ServerResponse(true, {
        success: true,
        message: `${existingCount} holidays already exist for country ${countryCode}`,
        total_populated: 0,
        already_populated: true
      }));
    }

    // Guard concurrent first-hit population (UNIQUE (country_code, name, date) also exists).
    const lockClient = await db.connect();
    const lockKey = `populate-country-holidays-${countryCode}`;
    let lockAcquired = false;

    try {
      const lockResult = await lockClient.query(
        "SELECT pg_try_advisory_lock(hashtext($1)) AS locked;",
        [lockKey]
      );
      lockAcquired = Boolean(lockResult.rows[0]?.locked);

      if (!lockAcquired) {
        return res.status(200).send(new ServerResponse(true, {
          success: false,
          message: `Holiday population for ${countryCode} is already in progress`,
          total_populated: 0,
          already_populated: false,
          in_progress: true,
          country_code: countryCode
        }));
      }

      // Re-check after acquiring the lock in case another request finished while we waited.
      const recheckResult = await db.query(existingQ, [countryCode]);
      const recheckCount = parseInt(recheckResult.rows[0]?.count || "0", 10);
      if (recheckCount > 0) {
        return res.status(200).send(new ServerResponse(true, {
          success: true,
          message: `${recheckCount} holidays already exist for country ${countryCode}`,
          total_populated: 0,
          already_populated: true,
          country_code: countryCode
        }));
      }

      const totalPopulated = await insertPublicHolidaysForCountry(countryCode);

      return res.status(200).send(new ServerResponse(true, {
        success: totalPopulated > 0,
        message: `Successfully populated ${totalPopulated} holidays for ${countryCode}`,
        total_populated: totalPopulated,
        country_code: countryCode
      }));
    } catch (error) {
      log_error(error);
      return res.status(500).send(new ServerResponse(false, {
        message: `Error populating holidays: ${error instanceof Error ? error.message : "Unknown error"}`,
        country_code: countryCode
      }));
    } finally {
      if (lockAcquired) {
        try {
          await lockClient.query("SELECT pg_advisory_unlock(hashtext($1));", [lockKey]);
        } catch (unlockError) {
          log_error(unlockError);
        }
      }
      lockClient.release();
    }
  }
} 
