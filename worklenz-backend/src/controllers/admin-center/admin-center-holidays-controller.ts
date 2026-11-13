import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";

import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import { actorFromSessionUser, logAuditEvent } from "../../services/audit-log.service";
import { AUDIT_EVENT_TYPE } from "../../shared/audit-log-constants";

export default class AdminCenterHolidaysController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getOrganizationHolidaySettings(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT ohs.id, ohs.organization_id, ohs.country_code, ohs.state_code, 
                      ohs.auto_sync_holidays, ohs.created_at, ohs.updated_at
               FROM organization_holiday_settings ohs
               JOIN organizations o ON ohs.organization_id = o.id
               WHERE o.user_id = $1;`;

    const result = await db.query(q, [req.user?.owner_id]);

    // If no settings exist, return default settings
    if (result.rows.length === 0) {
      return res.status(200).send(
        new ServerResponse(true, {
          country_code: null,
          state_code: null,
          auto_sync_holidays: true,
        })
      );
    }

    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  @HandleExceptions()
  public static async updateOrganizationHolidaySettings(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { country_code, state_code, auto_sync_holidays } = req.body;

    // First, get the organization ID
    const orgQ = `SELECT id FROM organizations WHERE user_id = $1;`;
    const orgResult = await db.query(orgQ, [req.user?.owner_id]);

    if (orgResult.rows.length === 0) {
      return res
        .status(404)
        .send(new ServerResponse(false, "Organization not found"));
    }

    const organizationId = orgResult.rows[0].id;

    // Check if settings already exist (also capture previous country for cleanup)
    const checkQ = `SELECT id, country_code FROM organization_holiday_settings WHERE organization_id = $1;`;
    const checkResult = await db.query(checkQ, [organizationId]);
    const previousCountryCode = checkResult.rows[0]?.country_code as string | null | undefined;

    let result;
    if (checkResult.rows.length > 0) {
      // Update existing settings
      const updateQ = `UPDATE organization_holiday_settings 
                       SET country_code = $2, 
                           state_code = $3, 
                           auto_sync_holidays = $4,
                           updated_at = CURRENT_TIMESTAMP
                       WHERE organization_id = $1
                       RETURNING *;`;
      result = await db.query(updateQ, [
        organizationId,
        country_code,
        state_code,
        auto_sync_holidays,
      ]);
    } else {
      // Insert new settings
      const insertQ = `INSERT INTO organization_holiday_settings 
                       (organization_id, country_code, state_code, auto_sync_holidays)
                       VALUES ($1, $2, $3, $4)
                       RETURNING *;`;
      result = await db.query(insertQ, [
        organizationId,
        country_code,
        state_code,
        auto_sync_holidays,
      ]);
    }

    // Audit log
    if (req.user?.organization_id && previousCountryCode !== country_code) {
      logAuditEvent({
        organizationId: req.user.organization_id,
        teamId: req.user.team_id || null,
        actor: actorFromSessionUser(req.user),
        eventType: AUDIT_EVENT_TYPE.WORKSPACE_SETTING_CHANGED.id,
        description: `Workspace holiday country changed`,
        oldValue: previousCountryCode || null,
        newValue: country_code || null,
      });
    }

    // When country changes, remove previously auto-synced official holidays from
    // organization_holidays so they no longer appear alongside the new country's holidays.
    // Manual holidays (is_auto_synced = FALSE) are always kept, even when they share a
    // name/date with an official holiday (e.g. Christmas Day). Legacy synced rows were
    // flagged by the 20260921120000 migration.
    if (previousCountryCode && previousCountryCode !== country_code) {
      try {
        const cleanupQ = `
          DELETE FROM organization_holidays
          WHERE organization_id = $1
            AND is_auto_synced = TRUE
        `;
        await db.query(cleanupQ, [organizationId]);
      } catch (error) {
        console.error("Error cleaning up previous country holidays:", error);
      }
    }

    // Official holidays live in country_holidays and are merged at read time.
    // Only ensure Sri Lankan country_holidays are populated — do not copy them
    // into organization_holidays (that caused Poya days to stick after country change).
    if (auto_sync_holidays && country_code === "LK") {
      try {
        const {
          HolidayDataProvider,
        } = require("../../services/holiday-data-provider");

        const currentYear = new Date().getFullYear();
        const years = [currentYear, currentYear + 1];

        for (const year of years) {
          const sriLankanHolidays =
            await HolidayDataProvider.getSriLankanHolidays(year);

          for (const holiday of sriLankanHolidays) {
            const insertCountryQuery = `
              INSERT INTO country_holidays (country_code, name, description, date, is_recurring)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (country_code, name, date) DO NOTHING
            `;

            await db.query(insertCountryQuery, [
              "LK",
              holiday.name,
              holiday.description,
              holiday.date,
              holiday.is_recurring,
            ]);
          }
        }
      } catch (error) {
        // Log error but don't fail the settings update
        console.error("Error syncing Sri Lankan holidays:", error);
      }
    }

    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  @HandleExceptions()
  public static async getCountriesWithStates(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    // Get all countries
    const countriesQ = `SELECT code, name FROM countries ORDER BY name;`;
    const countriesResult = await db.query(countriesQ);

    // For now, we'll return a basic structure
    // In a real implementation, you would have a states table
    const countriesWithStates = countriesResult.rows.map((country) => ({
      code: country.code,
      name: country.name,
      states: [] as Array<{ code: string; name: string }>, // Would be populated from a states table
    }));

    // Add all US states, DC, and territories
    const usIndex = countriesWithStates.findIndex((c) => c.code === "US");
    if (usIndex !== -1) {
      countriesWithStates[usIndex].states = [
        { code: "AL", name: "Alabama" },
        { code: "AK", name: "Alaska" },
        { code: "AZ", name: "Arizona" },
        { code: "AR", name: "Arkansas" },
        { code: "CA", name: "California" },
        { code: "CO", name: "Colorado" },
        { code: "CT", name: "Connecticut" },
        { code: "DE", name: "Delaware" },
        { code: "FL", name: "Florida" },
        { code: "GA", name: "Georgia" },
        { code: "HI", name: "Hawaii" },
        { code: "ID", name: "Idaho" },
        { code: "IL", name: "Illinois" },
        { code: "IN", name: "Indiana" },
        { code: "IA", name: "Iowa" },
        { code: "KS", name: "Kansas" },
        { code: "KY", name: "Kentucky" },
        { code: "LA", name: "Louisiana" },
        { code: "ME", name: "Maine" },
        { code: "MD", name: "Maryland" },
        { code: "MA", name: "Massachusetts" },
        { code: "MI", name: "Michigan" },
        { code: "MN", name: "Minnesota" },
        { code: "MS", name: "Mississippi" },
        { code: "MO", name: "Missouri" },
        { code: "MT", name: "Montana" },
        { code: "NE", name: "Nebraska" },
        { code: "NV", name: "Nevada" },
        { code: "NH", name: "New Hampshire" },
        { code: "NJ", name: "New Jersey" },
        { code: "NM", name: "New Mexico" },
        { code: "NY", name: "New York" },
        { code: "NC", name: "North Carolina" },
        { code: "ND", name: "North Dakota" },
        { code: "OH", name: "Ohio" },
        { code: "OK", name: "Oklahoma" },
        { code: "OR", name: "Oregon" },
        { code: "PA", name: "Pennsylvania" },
        { code: "RI", name: "Rhode Island" },
        { code: "SC", name: "South Carolina" },
        { code: "SD", name: "South Dakota" },
        { code: "TN", name: "Tennessee" },
        { code: "TX", name: "Texas" },
        { code: "UT", name: "Utah" },
        { code: "VT", name: "Vermont" },
        { code: "VA", name: "Virginia" },
        { code: "WA", name: "Washington" },
        { code: "WV", name: "West Virginia" },
        { code: "WI", name: "Wisconsin" },
        { code: "WY", name: "Wyoming" },
        { code: "DC", name: "District of Columbia" },
        { code: "AS", name: "American Samoa" },
        { code: "GU", name: "Guam" },
        { code: "MP", name: "Northern Mariana Islands" },
        { code: "PR", name: "Puerto Rico" },
        { code: "VI", name: "U.S. Virgin Islands" },
      ];
    }

    // Add all Canadian provinces and territories
    const caIndex = countriesWithStates.findIndex((c) => c.code === "CA");
    if (caIndex !== -1) {
      countriesWithStates[caIndex].states = [
        { code: "AB", name: "Alberta" },
        { code: "BC", name: "British Columbia" },
        { code: "MB", name: "Manitoba" },
        { code: "NB", name: "New Brunswick" },
        { code: "NL", name: "Newfoundland and Labrador" },
        { code: "NS", name: "Nova Scotia" },
        { code: "ON", name: "Ontario" },
        { code: "PE", name: "Prince Edward Island" },
        { code: "QC", name: "Quebec" },
        { code: "SK", name: "Saskatchewan" },
        { code: "NT", name: "Northwest Territories" },
        { code: "NU", name: "Nunavut" },
        { code: "YT", name: "Yukon" },
      ];
    }

    return res.status(200).send(new ServerResponse(true, countriesWithStates));
  }
}
