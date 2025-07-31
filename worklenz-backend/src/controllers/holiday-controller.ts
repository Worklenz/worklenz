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
    const yearFilter = year ? `AND EXTRACT(YEAR FROM date) = $2` : "";
    const params = year ? [req.user?.owner_id, year] : [req.user?.owner_id];

    const q = `SELECT oh.id, oh.organization_id, oh.holiday_type_id, oh.name, oh.description, 
                      oh.date, oh.is_recurring, oh.created_at, oh.updated_at,
                      ht.name as holiday_type_name, ht.color_code
               FROM organization_holidays oh
               JOIN holiday_types ht ON oh.holiday_type_id = ht.id
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

    const q = `INSERT INTO organization_holidays (organization_id, holiday_type_id, name, description, date, is_recurring)
               VALUES (
                 (SELECT id FROM organizations WHERE user_id = $1),
                 $2, $3, $4, $5, $6
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
    const { country_code, year } = req.query;
    
    if (!country_code) {
      return res.status(400).send(new ServerResponse(false, "Country code is required"));
    }

    const yearFilter = year ? `AND EXTRACT(YEAR FROM date) = $2` : "";
    const params = year ? [country_code, year] : [country_code];

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
    const importQ = `INSERT INTO organization_holidays (organization_id, holiday_type_id, name, description, date, is_recurring)
                     VALUES ($1, $2, $3, $4, $5, $6)
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

    const q = `SELECT oh.id, oh.name, oh.description, oh.date, oh.is_recurring,
                      ht.name as holiday_type_name, ht.color_code,
                      'organization' as source
               FROM organization_holidays oh
               JOIN holiday_types ht ON oh.holiday_type_id = ht.id
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
               JOIN organizations o ON ch.country_code = (
                 SELECT c.code FROM countries c WHERE c.id = o.country
               )
               WHERE o.user_id = $1
               AND EXTRACT(YEAR FROM ch.date) = $2
               AND EXTRACT(MONTH FROM ch.date) = $3
               
               ORDER BY date;`;
    
    const result = await db.query(q, [req.user?.owner_id, year, month]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async populateCountryHolidays(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // Check if this organization has recently populated holidays (within last hour)
    const recentPopulationCheck = `
      SELECT COUNT(*) as count
      FROM organization_holidays 
      WHERE organization_id = (SELECT id FROM organizations WHERE user_id = $1)
      AND created_at > NOW() - INTERVAL '1 hour'
    `;
    
    const recentResult = await db.query(recentPopulationCheck, [req.user?.owner_id]);
    const recentCount = parseInt(recentResult.rows[0]?.count || '0');
    
    // If there are recent holidays added, skip population
    if (recentCount > 10) {
      return res.status(200).send(new ServerResponse(true, {
        success: true,
        message: "Holidays were recently populated, skipping to avoid duplicates",
        total_populated: 0,
        recently_populated: true
      }));
    }

    const Holidays = require("date-holidays");

    const countries = [
      { code: "US", name: "United States" },
      { code: "GB", name: "United Kingdom" },
      { code: "CA", name: "Canada" },
      { code: "AU", name: "Australia" },
      { code: "DE", name: "Germany" },
      { code: "FR", name: "France" },
      { code: "IT", name: "Italy" },
      { code: "ES", name: "Spain" },
      { code: "NL", name: "Netherlands" },
      { code: "BE", name: "Belgium" },
      { code: "CH", name: "Switzerland" },
      { code: "AT", name: "Austria" },
      { code: "SE", name: "Sweden" },
      { code: "NO", name: "Norway" },
      { code: "DK", name: "Denmark" },
      { code: "FI", name: "Finland" },
      { code: "PL", name: "Poland" },
      { code: "CZ", name: "Czech Republic" },
      { code: "HU", name: "Hungary" },
      { code: "RO", name: "Romania" },
      { code: "BG", name: "Bulgaria" },
      { code: "HR", name: "Croatia" },
      { code: "SI", name: "Slovenia" },
      { code: "SK", name: "Slovakia" },
      { code: "LT", name: "Lithuania" },
      { code: "LV", name: "Latvia" },
      { code: "EE", name: "Estonia" },
      { code: "IE", name: "Ireland" },
      { code: "PT", name: "Portugal" },
      { code: "GR", name: "Greece" },
      { code: "CY", name: "Cyprus" },
      { code: "MT", name: "Malta" },
      { code: "LU", name: "Luxembourg" },
      { code: "IS", name: "Iceland" },
      { code: "CN", name: "China" },
      { code: "JP", name: "Japan" },
      { code: "KR", name: "South Korea" },
      { code: "IN", name: "India" },
      { code: "BR", name: "Brazil" },
      { code: "AR", name: "Argentina" },
      { code: "MX", name: "Mexico" },
      { code: "ZA", name: "South Africa" },
      { code: "NZ", name: "New Zealand" },
      { code: "LK", name: "Sri Lanka" }
    ];

    let totalPopulated = 0;
    const errors = [];

    for (const country of countries) {
      try {
        // Special handling for Sri Lanka
        if (country.code === 'LK') {
          // Import the holiday data provider
          const { HolidayDataProvider } = require("../services/holiday-data-provider");
          
          for (let year = 2020; year <= 2050; year++) {
            const sriLankanHolidays = await HolidayDataProvider.getSriLankanHolidays(year);
            
            for (const holiday of sriLankanHolidays) {
              const query = `
                INSERT INTO country_holidays (country_code, name, description, date, is_recurring)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (country_code, name, date) DO NOTHING
              `;
              
              await db.query(query, [
                'LK',
                holiday.name,
                holiday.description,
                holiday.date,
                holiday.is_recurring
              ]);
              
              totalPopulated++;
            }
          }
        } else {
          // Use date-holidays for other countries
          const hd = new Holidays(country.code);
          
          for (let year = 2020; year <= 2050; year++) {
            const holidays = hd.getHolidays(year);
            
            for (const holiday of holidays) {
              if (!holiday.date || typeof holiday.date !== "object") {
                continue;
              }
              
              const dateStr = holiday.date.toISOString().split("T")[0];
              const name = holiday.name || "Unknown Holiday";
              const description = holiday.type || "Public Holiday";
              
              const query = `
                INSERT INTO country_holidays (country_code, name, description, date, is_recurring)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (country_code, name, date) DO NOTHING
              `;
              
              await db.query(query, [
                country.code,
                name,
                description,
                dateStr,
                true
              ]);
              
              totalPopulated++;
            }
          }
        }
      } catch (error: any) {
        errors.push(`${country.name}: ${error?.message || "Unknown error"}`);
      }
    }

    const response = {
      success: true,
      message: `Successfully populated ${totalPopulated} holidays`,
      total_populated: totalPopulated,
      errors: errors.length > 0 ? errors : undefined
    };

    return res.status(200).send(new ServerResponse(true, response));
  }
} 