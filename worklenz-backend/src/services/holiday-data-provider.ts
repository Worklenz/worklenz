import moment from "moment";
import db from "../config/db";
import * as fs from "fs";
import * as path from "path";

interface HolidayData {
  name: string;
  date: string;
  description: string;
  is_recurring: boolean;
}

export class HolidayDataProvider {
  /**
   * Fetch Sri Lankan holidays from external API or database
   * This provides a centralized way to get accurate holiday data
   */
  public static async getSriLankanHolidays(year: number): Promise<HolidayData[]> {
    try {
      // First, check if we have data in the database for this year
      const dbHolidays = await this.getHolidaysFromDatabase("LK", year);
      if (dbHolidays.length > 0) {
        return dbHolidays;
      }

      // Load holidays from JSON file
      const holidaysFromFile = this.getHolidaysFromFile(year);
      if (holidaysFromFile.length > 0) {
        // Store in database for future use
        await this.storeHolidaysInDatabase("LK", holidaysFromFile);
        return holidaysFromFile;
      }

      // If specific year not found, generate from fixed holidays + fallback
      return this.generateHolidaysFromFixed(year);
    } catch (error) {
      console.error("Error fetching Sri Lankan holidays:", error);
      // Fallback to basic holidays
      return this.getBasicSriLankanHolidays(year);
    }
  }

  private static async getHolidaysFromDatabase(countryCode: string, year: number): Promise<HolidayData[]> {
    const query = `
      SELECT name, date, description, is_recurring
      FROM country_holidays
      WHERE country_code = $1
        AND EXTRACT(YEAR FROM date) = $2
      ORDER BY date
    `;
    const result = await db.query(query, [countryCode, year]);
    return result.rows.map(row => ({
      name: row.name,
      date: moment(row.date).format("YYYY-MM-DD"),
      description: row.description,
      is_recurring: row.is_recurring
    }));
  }

  private static async storeHolidaysInDatabase(countryCode: string, holidays: HolidayData[]): Promise<void> {
    for (const holiday of holidays) {
      const query = `
        INSERT INTO country_holidays (country_code, name, description, date, is_recurring)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (country_code, name, date) DO NOTHING
      `;
      await db.query(query, [
        countryCode,
        holiday.name,
        holiday.description,
        holiday.date,
        holiday.is_recurring
      ]);
    }
  }

  private static getHolidaysFromFile(year: number): HolidayData[] {
    try {
      const filePath = path.join(__dirname, "..", "data", "sri-lankan-holidays.json");
      const fileContent = fs.readFileSync(filePath, "utf8");
      const holidayData = JSON.parse(fileContent);
      
      // Check if we have data for the specific year
      if (holidayData[year.toString()]) {
        return holidayData[year.toString()].map((holiday: any) => ({
          name: holiday.name,
          date: holiday.date,
          description: holiday.description,
          is_recurring: holiday.is_recurring
        }));
      }
      
      return [];
    } catch (error) {
      console.error("Error reading holidays from file:", error);
      return [];
    }
  }

  private static generateHolidaysFromFixed(year: number): HolidayData[] {
    try {
      const filePath = path.join(__dirname, "..", "data", "sri-lankan-holidays.json");
      const fileContent = fs.readFileSync(filePath, "utf8");
      const holidayData = JSON.parse(fileContent);
      
      // Generate holidays from fixed_holidays for the given year
      if (holidayData.fixed_holidays) {
        const fixedHolidays = holidayData.fixed_holidays.map((holiday: any) => ({
          name: holiday.name,
          date: `${year}-${String(holiday.month).padStart(2, "0")}-${String(holiday.day).padStart(2, "0")}`,
          description: holiday.description,
          is_recurring: true
        }));
        
        // Log warning about incomplete data
        console.warn(`⚠️  Using only fixed holidays for Sri Lankan year ${year}. Poya days and religious holidays not included.`);
        console.warn(`   To add complete data, see: docs/sri-lankan-holiday-update-process.md`);
        
        return fixedHolidays;
      }
      
      return this.getBasicSriLankanHolidays(year);
    } catch (error) {
      console.error("Error generating holidays from fixed data:", error);
      return this.getBasicSriLankanHolidays(year);
    }
  }

  private static getSriLankan2025Holidays(): HolidayData[] {
    // Import the 2025 data we already have
    return [
      // Poya Days
      { name: "Duruthu Full Moon Poya Day", date: "2025-01-13", description: "Commemorates the first visit of Buddha to Sri Lanka", is_recurring: false },
      { name: "Navam Full Moon Poya Day", date: "2025-02-12", description: "Commemorates the appointment of Sariputta and Moggallana as Buddha's chief disciples", is_recurring: false },
      { name: "Medin Full Moon Poya Day", date: "2025-03-14", description: "Commemorates Buddha's first visit to his father's palace after enlightenment", is_recurring: false },
      { name: "Bak Full Moon Poya Day", date: "2025-04-12", description: "Commemorates Buddha's second visit to Sri Lanka", is_recurring: false },
      { name: "Vesak Full Moon Poya Day", date: "2025-05-12", description: "Most sacred day for Buddhists", is_recurring: false },
      { name: "Poson Full Moon Poya Day", date: "2025-06-11", description: "Commemorates the introduction of Buddhism to Sri Lanka", is_recurring: false },
      { name: "Esala Full Moon Poya Day", date: "2025-07-10", description: "Commemorates Buddha's first sermon", is_recurring: false },
      { name: "Nikini Full Moon Poya Day", date: "2025-08-09", description: "Commemorates the first Buddhist council", is_recurring: false },
      { name: "Binara Full Moon Poya Day", date: "2025-09-07", description: "Commemorates Buddha's visit to heaven", is_recurring: false },
      { name: "Vap Full Moon Poya Day", date: "2025-10-07", description: "Marks the end of Buddhist Lent", is_recurring: false },
      { name: "Il Full Moon Poya Day", date: "2025-11-05", description: "Commemorates Buddha's ordination of sixty disciples", is_recurring: false },
      { name: "Unduvap Full Moon Poya Day", date: "2025-12-04", description: "Commemorates the arrival of Sanghamitta Theri", is_recurring: false },
      
      // Fixed holidays
      { name: "Independence Day", date: "2025-02-04", description: "Sri Lankan Independence Day", is_recurring: true },
      { name: "Sinhala and Tamil New Year Day", date: "2025-04-13", description: "Traditional New Year", is_recurring: true },
      { name: "Day after Sinhala and Tamil New Year", date: "2025-04-14", description: "New Year celebrations", is_recurring: true },
      { name: "May Day", date: "2025-05-01", description: "International Workers' Day", is_recurring: true },
      { name: "Christmas Day", date: "2025-12-25", description: "Christmas", is_recurring: true },
      
      // Variable holidays
      { name: "Good Friday", date: "2025-04-18", description: "Christian holiday", is_recurring: false },
      { name: "Day after Vesak Full Moon Poya Day", date: "2025-05-13", description: "Vesak celebrations", is_recurring: false },
      { name: "Eid al-Fitr", date: "2025-03-31", description: "End of Ramadan", is_recurring: false },
      { name: "Deepavali", date: "2025-10-20", description: "Hindu Festival of Lights", is_recurring: false }
    ];
  }

  private static generateApproximateHolidays(year: number): HolidayData[] {
    // This is a fallback method that generates approximate dates
    // In production, you should use accurate astronomical calculations or external data
    const holidays: HolidayData[] = [];
    
    // Fixed holidays
    holidays.push(
      { name: "Independence Day", date: `${year}-02-04`, description: "Sri Lankan Independence Day", is_recurring: true },
      { name: "Sinhala and Tamil New Year Day", date: `${year}-04-13`, description: "Traditional New Year", is_recurring: true },
      { name: "Day after Sinhala and Tamil New Year", date: `${year}-04-14`, description: "New Year celebrations", is_recurring: true },
      { name: "May Day", date: `${year}-05-01`, description: "International Workers' Day", is_recurring: true },
      { name: "Christmas Day", date: `${year}-12-25`, description: "Christmas", is_recurring: true }
    );
    
    // Note: For Poya days and other religious holidays, you would need
    // astronomical calculations or reliable external data sources
    
    return holidays;
  }

  private static getBasicSriLankanHolidays(year: number): HolidayData[] {
    // Return only the fixed holidays that don't change
    return [
      { name: "Independence Day", date: `${year}-02-04`, description: "Sri Lankan Independence Day", is_recurring: true },
      { name: "Sinhala and Tamil New Year Day", date: `${year}-04-13`, description: "Traditional New Year", is_recurring: true },
      { name: "Day after Sinhala and Tamil New Year", date: `${year}-04-14`, description: "New Year celebrations", is_recurring: true },
      { name: "May Day", date: `${year}-05-01`, description: "International Workers' Day", is_recurring: true },
      { name: "Christmas Day", date: `${year}-12-25`, description: "Christmas", is_recurring: true }
    ];
  }

  /**
   * Update organization holidays for a specific year
   * This can be called periodically to ensure holiday data is up to date
   */
  public static async updateOrganizationHolidays(organizationId: string, countryCode: string, year: number): Promise<void> {
    if (countryCode !== "LK") return;
    
    const holidays = await this.getSriLankanHolidays(year);
    
    // Get default holiday type
    const typeQuery = `SELECT id FROM holiday_types WHERE name = 'Public Holiday' LIMIT 1`;
    const typeResult = await db.query(typeQuery);
    const holidayTypeId = typeResult.rows[0]?.id;
    
    if (!holidayTypeId) return;
    
    // Insert holidays into organization_holidays
    for (const holiday of holidays) {
      const query = `
        INSERT INTO organization_holidays (organization_id, holiday_type_id, name, description, date, is_recurring)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (organization_id, date) DO NOTHING
      `;
      await db.query(query, [
        organizationId,
        holidayTypeId,
        holiday.name,
        holiday.description,
        holiday.date,
        holiday.is_recurring
      ]);
    }
  }
}