import moment from "moment";

interface SriLankanHoliday {
  name: string;
  date: string;
  type: "Public" | "Bank" | "Mercantile" | "Poya";
  description: string;
  is_recurring: boolean;
  is_poya: boolean;
  country_code: string;
  color_code: string;
}

export class SriLankanHolidayService {
  private static readonly COUNTRY_CODE = "LK";
  
  // Fixed recurring holidays (same date every year)
  private static readonly FIXED_HOLIDAYS = [
    {
      name: "Independence Day",
      month: 2,
      day: 4,
      type: "Public" as const,
      description: "Commemorates the independence of Sri Lanka from British rule in 1948",
      color_code: "#DC143C"
    },
    {
      name: "Sinhala and Tamil New Year Day",
      month: 4,
      day: 13,
      type: "Public" as const,
      description: "Traditional New Year celebrated by Sinhalese and Tamil communities",
      color_code: "#DC143C"
    },
    {
      name: "Day after Sinhala and Tamil New Year",
      month: 4,
      day: 14,
      type: "Public" as const,
      description: "Second day of traditional New Year celebrations",
      color_code: "#DC143C"
    },
    {
      name: "May Day",
      month: 5,
      day: 1,
      type: "Public" as const,
      description: "International Workers' Day",
      color_code: "#DC143C"
    },
    {
      name: "Christmas Day",
      month: 12,
      day: 25,
      type: "Public" as const,
      description: "Christian celebration of the birth of Jesus Christ",
      color_code: "#DC143C"
    }
  ];

  // Poya days names (in order of Buddhist months)
  private static readonly POYA_NAMES = [
    { name: "Duruthu", description: "Commemorates the first visit of Buddha to Sri Lanka" },
    { name: "Navam", description: "Commemorates the appointment of Sariputta and Moggallana as Buddha's chief disciples" },
    { name: "Medin", description: "Commemorates Buddha's first visit to his father's palace after enlightenment" },
    { name: "Bak", description: "Commemorates Buddha's second visit to Sri Lanka" },
    { name: "Vesak", description: "Most sacred day for Buddhists - commemorates birth, enlightenment and passing of Buddha" },
    { name: "Poson", description: "Commemorates the introduction of Buddhism to Sri Lanka by Arahat Mahinda" },
    { name: "Esala", description: "Commemorates Buddha's first sermon and the arrival of the Sacred Tooth Relic" },
    { name: "Nikini", description: "Commemorates the first Buddhist council" },
    { name: "Binara", description: "Commemorates Buddha's visit to heaven to preach to his mother" },
    { name: "Vap", description: "Marks the end of Buddhist Lent and Buddha's return from heaven" },
    { name: "Il", description: "Commemorates Buddha's ordination of sixty disciples" },
    { name: "Unduvap", description: "Commemorates the arrival of Sanghamitta Theri with the Sacred Bo sapling" }
  ];

  /**
   * Calculate Poya days for a given year
   * Note: This is a simplified calculation. For production use, consider using
   * astronomical calculations or an API that provides accurate lunar calendar dates
   */
  private static calculatePoyaDays(year: number): SriLankanHoliday[] {
    const poyaDays: SriLankanHoliday[] = [];
    
    // This is a simplified approach - in reality, you would need astronomical calculations
    // or use a service that provides accurate Buddhist lunar calendar dates
    // For now, we'll use approximate dates based on lunar month cycles
    
    // Starting from a known Vesak date (May full moon)
    // and calculating other Poya days based on lunar month intervals
    const baseVesakDate = this.getVesakDate(year);
    
    for (let i = 0; i < 12; i++) {
      const monthsFromVesak = i - 4; // Vesak is the 5th month
      const poyaDate = moment(baseVesakDate).add(monthsFromVesak * 29.53, "days"); // Lunar month average
      
      // Adjust to the nearest full moon date (would need proper calculation in production)
      const poyaInfo = this.POYA_NAMES[i];
      
      poyaDays.push({
        name: `${poyaInfo.name} Full Moon Poya Day`,
        date: poyaDate.format("YYYY-MM-DD"),
        type: "Poya",
        description: poyaInfo.description,
        is_recurring: false,
        is_poya: true,
        country_code: this.COUNTRY_CODE,
        color_code: "#8B4513"
      });
    }
    
    return poyaDays;
  }

  /**
   * Get approximate Vesak date for a year
   * Vesak typically falls on the full moon in May
   */
  private static getVesakDate(year: number): Date {
    // This is a simplified calculation
    // In production, use astronomical calculations or a reliable API
    const may1 = new Date(year, 4, 1); // May 1st
    const fullMoonDay = 15; // Approximate - would need proper lunar calculation
    return new Date(year, 4, fullMoonDay);
  }

  /**
   * Get Easter date for a year (Western/Gregorian calendar)
   * Using Computus algorithm
   */
  private static getEasterDate(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    
    return new Date(year, month - 1, day);
  }

  /**
   * Get all Sri Lankan holidays for a given year
   */
  public static getHolidaysForYear(year: number): SriLankanHoliday[] {
    const holidays: SriLankanHoliday[] = [];
    
    // Add fixed holidays
    for (const holiday of this.FIXED_HOLIDAYS) {
      holidays.push({
        ...holiday,
        date: `${year}-${String(holiday.month).padStart(2, "0")}-${String(holiday.day).padStart(2, "0")}`,
        is_recurring: true,
        is_poya: false,
        country_code: this.COUNTRY_CODE
      });
    }
    
    // Add Poya days
    const poyaDays = this.calculatePoyaDays(year);
    holidays.push(...poyaDays);
    
    // Add Good Friday (2 days before Easter)
    const easter = this.getEasterDate(year);
    const goodFriday = moment(easter).subtract(2, "days");
    holidays.push({
      name: "Good Friday",
      date: goodFriday.format("YYYY-MM-DD"),
      type: "Public",
      description: "Christian commemoration of the crucifixion of Jesus Christ",
      is_recurring: false,
      is_poya: false,
      country_code: this.COUNTRY_CODE,
      color_code: "#DC143C"
    });
    
    // Add day after Vesak
    const vesakDay = poyaDays.find(p => p.name.includes("Vesak"));
    if (vesakDay) {
      const dayAfterVesak = moment(vesakDay.date).add(1, "day");
      holidays.push({
        name: "Day after Vesak Full Moon Poya Day",
        date: dayAfterVesak.format("YYYY-MM-DD"),
        type: "Public",
        description: "Additional day for Vesak celebrations",
        is_recurring: false,
        is_poya: false,
        country_code: this.COUNTRY_CODE,
        color_code: "#DC143C"
      });
    }
    
    // Note: Eid and Deepavali dates would need to be calculated based on
    // Islamic and Hindu calendars respectively, or fetched from an external source
    
    return holidays.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Generate SQL insert statements for holidays
   */
  public static generateSQL(year: number, tableName = "country_holidays"): string {
    const holidays = this.getHolidaysForYear(year);
    const values = holidays.map(holiday => {
      return `('${this.COUNTRY_CODE}', '${holiday.name.replace(/'/g, "''")}', '${holiday.description.replace(/'/g, "''")}', '${holiday.date}', ${holiday.is_recurring})`;
    }).join(",\n  ");

    return `INSERT INTO ${tableName} (country_code, name, description, date, is_recurring)
VALUES
  ${values}
ON CONFLICT (country_code, name, date) DO NOTHING;`;
  }
}