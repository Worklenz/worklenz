/**
 * Sri Lankan Holidays for 2025
 *
 * This data can be used to seed the database with Sri Lankan holidays
 * Source: Central Bank of Sri Lanka, Ministry of Home Affairs
 *
 * Usage: Import this data in your backend seeder or database migration
 */

export interface SriLankanHolidayData {
  name: string;
  date: string;
  type: 'Public' | 'Bank' | 'Mercantile' | 'Poya';
  description: string;
  is_recurring: boolean;
  is_poya: boolean;
  country_code: string;
  color_code: string;
}

export const sriLankanHolidays2025: SriLankanHolidayData[] = [
  // January
  {
    name: 'Duruthu Full Moon Poya Day',
    date: '2025-01-13',
    type: 'Poya',
    description: 'Commemorates the first visit of Buddha to Sri Lanka',
    is_recurring: false, // Date changes yearly based on lunar calendar
    is_poya: true,
    country_code: 'LK',
    color_code: '#8B4513',
  },

  // February
  {
    name: 'Independence Day',
    date: '2025-02-04',
    type: 'Public',
    description: 'Commemorates the independence of Sri Lanka from British rule in 1948',
    is_recurring: true,
    is_poya: false,
    country_code: 'LK',
    color_code: '#DC143C',
  },
  {
    name: 'Navam Full Moon Poya Day',
    date: '2025-02-12',
    type: 'Poya',
    description:
      "Commemorates the appointment of Sariputta and Moggallana as Buddha's chief disciples",
    is_recurring: false,
    is_poya: true,
    country_code: 'LK',
    color_code: '#8B4513',
  },

  // March
  {
    name: 'Medin Full Moon Poya Day',
    date: '2025-03-14',
    type: 'Poya',
    description: "Commemorates Buddha's first visit to his father's palace after enlightenment",
    is_recurring: false,
    is_poya: true,
    country_code: 'LK',
    color_code: '#8B4513',
  },

  // April
  {
    name: 'Good Friday',
    date: '2025-04-18',
    type: 'Public',
    description: 'Christian commemoration of the crucifixion of Jesus Christ',
    is_recurring: false, // Date varies each year
    is_poya: false,
    country_code: 'LK',
    color_code: '#DC143C',
  },
  {
    name: 'Bak Full Moon Poya Day',
    date: '2025-04-12',
    type: 'Poya',
    description: "Commemorates Buddha's second visit to Sri Lanka",
    is_recurring: false,
    is_poya: true,
    country_code: 'LK',
    color_code: '#8B4513',
  },
  {
    name: 'Sinhala and Tamil New Year Day',
    date: '2025-04-13',
    type: 'Public',
    description: 'Traditional New Year celebrated by Sinhalese and Tamil communities',
    is_recurring: true,
    is_poya: false,
    country_code: 'LK',
    color_code: '#DC143C',
  },
  {
    name: 'Day after Sinhala and Tamil New Year',
    date: '2025-04-14',
    type: 'Public',
    description: 'Second day of traditional New Year celebrations',
    is_recurring: true,
    is_poya: false,
    country_code: 'LK',
    color_code: '#DC143C',
  },

  // May
  {
    name: 'May Day',
    date: '2025-05-01',
    type: 'Public',
    description: "International Workers' Day",
    is_recurring: true,
    is_poya: false,
    country_code: 'LK',
    color_code: '#DC143C',
  },
  {
    name: 'Vesak Full Moon Poya Day',
    date: '2025-05-12',
    type: 'Poya',
    description:
      'Most sacred day for Buddhists - commemorates birth, enlightenment and passing of Buddha',
    is_recurring: false,
    is_poya: true,
    country_code: 'LK',
    color_code: '#8B4513',
  },
  {
    name: 'Day after Vesak Full Moon Poya Day',
    date: '2025-05-13',
    type: 'Public',
    description: 'Additional day for Vesak celebrations',
    is_recurring: false,
    is_poya: false,
    country_code: 'LK',
    color_code: '#DC143C',
  },

  // June
  {
    name: 'Poson Full Moon Poya Day',
    date: '2025-06-11',
    type: 'Poya',
    description: 'Commemorates the introduction of Buddhism to Sri Lanka by Arahat Mahinda',
    is_recurring: false,
    is_poya: true,
    country_code: 'LK',
    color_code: '#8B4513',
  },
  {
    name: 'Eid al-Fitr',
    date: '2025-03-31', // Approximate - depends on moon sighting
    type: 'Public',
    description: 'Festival marking the end of Ramadan',
    is_recurring: false,
    is_poya: false,
    country_code: 'LK',
    color_code: '#DC143C',
  },

  // July
  {
    name: 'Esala Full Moon Poya Day',
    date: '2025-07-10',
    type: 'Poya',
    description: "Commemorates Buddha's first sermon and the arrival of the Sacred Tooth Relic",
    is_recurring: false,
    is_poya: true,
    country_code: 'LK',
    color_code: '#8B4513',
  },

  // August
  {
    name: 'Nikini Full Moon Poya Day',
    date: '2025-08-09',
    type: 'Poya',
    description: 'Commemorates the first Buddhist council',
    is_recurring: false,
    is_poya: true,
    country_code: 'LK',
    color_code: '#8B4513',
  },

  // September
  {
    name: 'Binara Full Moon Poya Day',
    date: '2025-09-07',
    type: 'Poya',
    description: "Commemorates Buddha's visit to heaven to preach to his mother",
    is_recurring: false,
    is_poya: true,
    country_code: 'LK',
    color_code: '#8B4513',
  },

  // October
  {
    name: 'Vap Full Moon Poya Day',
    date: '2025-10-07',
    type: 'Poya',
    description: "Marks the end of Buddhist Lent and Buddha's return from heaven",
    is_recurring: false,
    is_poya: true,
    country_code: 'LK',
    color_code: '#8B4513',
  },
  {
    name: 'Deepavali',
    date: '2025-10-20', // Approximate
    type: 'Public',
    description: 'Hindu Festival of Lights',
    is_recurring: false,
    is_poya: false,
    country_code: 'LK',
    color_code: '#DC143C',
  },

  // November
  {
    name: 'Il Full Moon Poya Day',
    date: '2025-11-05',
    type: 'Poya',
    description: "Commemorates Buddha's ordination of sixty disciples",
    is_recurring: false,
    is_poya: true,
    country_code: 'LK',
    color_code: '#8B4513',
  },

  // December
  {
    name: 'Unduvap Full Moon Poya Day',
    date: '2025-12-04',
    type: 'Poya',
    description: 'Commemorates the arrival of Sanghamitta Theri with the Sacred Bo sapling',
    is_recurring: false,
    is_poya: true,
    country_code: 'LK',
    color_code: '#8B4513',
  },
  {
    name: 'Christmas Day',
    date: '2025-12-25',
    type: 'Public',
    description: 'Christian celebration of the birth of Jesus Christ',
    is_recurring: true,
    is_poya: false,
    country_code: 'LK',
    color_code: '#DC143C',
  },
];

/**
 * Get holidays by type
 */
export const getSriLankanHolidaysByType = (
  type: 'Public' | 'Bank' | 'Mercantile' | 'Poya'
): SriLankanHolidayData[] => {
  return sriLankanHolidays2025.filter(holiday => holiday.type === type);
};

/**
 * Get Poya days only
 */
export const getSriLankanPoyaDays = (): SriLankanHolidayData[] => {
  return sriLankanHolidays2025.filter(holiday => holiday.is_poya);
};

/**
 * Get holidays for a specific month (1-12)
 */
export const getSriLankanHolidaysByMonth = (month: number): SriLankanHolidayData[] => {
  return sriLankanHolidays2025.filter(holiday => {
    const holidayMonth = new Date(holiday.date).getMonth() + 1;
    return holidayMonth === month;
  });
};

/**
 * SQL Insert Statement Generator
 * Generates SQL for inserting holidays into database
 */
export const generateSriLankanHolidaySQL = (tableName: string = 'holidays'): string => {
  const values = sriLankanHolidays2025
    .map(holiday => {
      return `('${holiday.name}', '${holiday.date}', '${holiday.type}', '${holiday.description}', ${holiday.is_recurring}, ${holiday.is_poya}, '${holiday.country_code}', '${holiday.color_code}')`;
    })
    .join(',\n  ');

  return `INSERT INTO ${tableName} (name, date, type, description, is_recurring, is_poya, country_code, color_code)
VALUES
  ${values};`;
};

/**
 * JSON format for direct database import
 */
export const sriLankanHolidaysJSON = JSON.stringify(sriLankanHolidays2025, null, 2);
