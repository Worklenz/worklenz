/**
 * Script to update Sri Lankan holidays JSON file
 * 
 * This script can be used to:
 * 1. Add holidays for new years
 * 2. Update existing holiday data
 * 3. Generate SQL migration files
 * 
 * Usage:
 * node update-sri-lankan-holidays.js --year 2029 --add-poya-days
 * node update-sri-lankan-holidays.js --generate-sql --year 2029
 */

const fs = require("fs");
const path = require("path");

class SriLankanHolidayUpdater {
  constructor() {
    this.filePath = path.join(__dirname, "..", "data", "sri-lankan-holidays.json");
    this.holidayData = this.loadHolidayData();
  }

  loadHolidayData() {
    try {
      const content = fs.readFileSync(this.filePath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      console.error("Error loading holiday data:", error);
      return { fixed_holidays: [] };
    }
  }

  saveHolidayData() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.holidayData, null, 2));
      console.log("Holiday data saved successfully");
    } catch (error) {
      console.error("Error saving holiday data:", error);
    }
  }

  // Generate fixed holidays for a year
  generateFixedHolidays(year) {
    return this.holidayData.fixed_holidays.map(holiday => ({
      name: holiday.name,
      date: `${year}-${String(holiday.month).padStart(2, "0")}-${String(holiday.day).padStart(2, "0")}`,
      type: holiday.type,
      description: holiday.description,
      is_recurring: true
    }));
  }

  // Add a new year with basic holidays
  addYear(year) {
    if (this.holidayData[year.toString()]) {
      console.log(`Year ${year} already exists`);
      return;
    }

    const fixedHolidays = this.generateFixedHolidays(year);
    this.holidayData[year.toString()] = fixedHolidays;
    
    console.log(`Added basic holidays for year ${year}`);
    console.log("Note: You need to manually add Poya days, Good Friday, Eid, and Deepavali dates");
  }

  // Generate SQL for a specific year
  generateSQL(year) {
    const yearData = this.holidayData[year.toString()];
    if (!yearData) {
      console.log(`No data found for year ${year}`);
      return;
    }

    const values = yearData.map(holiday => {
      return `('LK', '${holiday.name.replace(/'/g, "''")}', '${holiday.description.replace(/'/g, "''")}', '${holiday.date}', ${holiday.is_recurring})`;
    }).join(",\n    ");

    const sql = `-- ${year} Sri Lankan holidays
INSERT INTO country_holidays (country_code, name, description, date, is_recurring)
VALUES
    ${values}
ON CONFLICT (country_code, name, date) DO NOTHING;`;

    console.log(sql);
    return sql;
  }

  // List all available years
  listYears() {
    const years = Object.keys(this.holidayData)
      .filter(key => key !== "fixed_holidays" && key !== "_metadata" && key !== "variable_holidays_info")
      .sort();
    
    console.log("📅 Available years:", years.join(", "));
    console.log("");
    
    years.forEach(year => {
      const count = this.holidayData[year].length;
      const source = this.holidayData._metadata?.sources?.[year] || "Unknown source";
      console.log(`  ${year}: ${count} holidays - ${source}`);
    });
    
    console.log("");
    console.log("⚠️  IMPORTANT: Only 2025 data has been verified from official sources.");
    console.log("   Future years should be verified before production use.");
    console.log("");
    console.log("📖 See docs/sri-lankan-holiday-update-process.md for verification process");
  }

  // Validate holiday data
  validate() {
    const issues = [];
    
    Object.keys(this.holidayData).forEach(year => {
      if (year === "fixed_holidays") return;
      
      const holidays = this.holidayData[year];
      holidays.forEach((holiday, index) => {
        // Check required fields
        if (!holiday.name) issues.push(`${year}[${index}]: Missing name`);
        if (!holiday.date) issues.push(`${year}[${index}]: Missing date`);
        if (!holiday.description) issues.push(`${year}[${index}]: Missing description`);
        
        // Check date format
        if (holiday.date && !/^\d{4}-\d{2}-\d{2}$/.test(holiday.date)) {
          issues.push(`${year}[${index}]: Invalid date format: ${holiday.date}`);
        }
        
        // Check if date matches the year
        if (holiday.date && !holiday.date.startsWith(year)) {
          issues.push(`${year}[${index}]: Date ${holiday.date} doesn't match year ${year}`);
        }
      });
    });
    
    if (issues.length === 0) {
      console.log("✅ All holiday data is valid");
    } else {
      console.log("❌ Found issues:");
      issues.forEach(issue => console.log(`  ${issue}`));
    }
    
    return issues.length === 0;
  }

  // Template for adding Poya days (user needs to provide actual dates)
  getPoyaDayTemplate(year) { 
    const poyaDays = [
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

    console.log(`\n=== TEMPLATE FOR ${year} SRI LANKAN HOLIDAYS ===\n`);
    
    console.log(`// Fixed holidays (same every year)`);
    console.log(`{
  "name": "Independence Day",
  "date": "${year}-02-04",
  "type": "Public", 
  "description": "Commemorates the independence of Sri Lanka from British rule in 1948",
  "is_recurring": true
},
{
  "name": "May Day",
  "date": "${year}-05-01", 
  "type": "Public",
  "description": "International Workers' Day",
  "is_recurring": true
},
{
  "name": "Christmas Day",
  "date": "${year}-12-25",
  "type": "Public",
  "description": "Christian celebration of the birth of Jesus Christ", 
  "is_recurring": true
},`);

    console.log(`\n// Variable holidays (need to verify dates)`);
    console.log(`{
  "name": "Sinhala and Tamil New Year Day",
  "date": "${year}-04-??", // Usually April 13, but can be 12 or 14
  "type": "Public",
  "description": "Traditional New Year celebrated by Sinhalese and Tamil communities",
  "is_recurring": false
},
{
  "name": "Day after Sinhala and Tamil New Year", 
  "date": "${year}-04-??", // Day after New Year Day
  "type": "Public",
  "description": "Second day of traditional New Year celebrations",
  "is_recurring": false
},`);

    console.log(`\n// Poya Days (lunar calendar - need to find actual dates):`);
    poyaDays.forEach((poya, index) => {
      console.log(`{
  "name": "${poya.name} Full Moon Poya Day",
  "date": "${year}-??-??",
  "type": "Poya",
  "description": "${poya.description}",
  "is_recurring": false
},`);
    });

    console.log(`\n// Religious holidays (need to verify dates)`);
    console.log(`{
  "name": "Good Friday",
  "date": "${year}-??-??", // Based on Easter calculation
  "type": "Public",
  "description": "Christian commemoration of the crucifixion of Jesus Christ",
  "is_recurring": false
},
{
  "name": "Eid al-Fitr", 
  "date": "${year}-??-??", // Islamic lunar calendar
  "type": "Public",
  "description": "Festival marking the end of Ramadan",
  "is_recurring": false
},
{
  "name": "Eid al-Adha",
  "date": "${year}-??-??", // Islamic lunar calendar  
  "type": "Public",
  "description": "Islamic festival of sacrifice",
  "is_recurring": false
},
{
  "name": "Deepavali",
  "date": "${year}-??-??", // Hindu lunar calendar
  "type": "Public", 
  "description": "Hindu Festival of Lights",
  "is_recurring": false
}`);

    console.log(`\n=== NOTES ===`);
    console.log(`1. Sinhala & Tamil New Year: Check official gazette or Department of Meteorology`);
    console.log(`2. Poya Days: Check Buddhist calendar or astronomical calculations`);
    console.log(`3. Good Friday: Calculate based on Easter (Western calendar)`);
    console.log(`4. Islamic holidays: Check Islamic calendar or local mosque announcements`);
    console.log(`5. Deepavali: Check Hindu calendar or Tamil cultural organizations`);
    console.log(`\nReliable sources:`);
    console.log(`- Sri Lanka Department of Meteorology`);
    console.log(`- Central Bank of Sri Lanka holiday circulars`);
    console.log(`- Ministry of Public Administration gazette notifications`);
  }

  // Show information about variable holidays
  showVariableHolidayInfo() {
    console.log(`\n=== SRI LANKAN VARIABLE HOLIDAYS INFO ===\n`);
    
    console.log(`🗓️  SINHALA & TAMIL NEW YEAR:`);
    console.log(`   • Usually April 13-14, but can vary to April 12-13 or April 14-15`);
    console.log(`   • Based on astrological calculations`);
    console.log(`   • Check: Department of Meteorology or official gazette\n`);
    
    console.log(`🌕 POYA DAYS (12 per year):`);
    console.log(`   • Follow Buddhist lunar calendar`); 
    console.log(`   • Dates change every year`);
    console.log(`   • Usually fall on full moon days\n`);
    
    console.log(`🕊️  GOOD FRIDAY:`);
    console.log(`   • Based on Easter calculation (Western Christianity)`);
    console.log(`   • First Sunday after first full moon after March 21\n`);
    
    console.log(`☪️  ISLAMIC HOLIDAYS (Eid al-Fitr, Eid al-Adha):`);
    console.log(`   • Follow Islamic lunar calendar (Hijri)`);
    console.log(`   • Dates shift ~11 days earlier each year`);
    console.log(`   • Depend on moon sighting\n`);
    
    console.log(`🪔 DEEPAVALI:`);
    console.log(`   • Hindu Festival of Lights`);
    console.log(`   • Based on Hindu lunar calendar`);
    console.log(`   • Usually October/November\n`);
    
    console.log(`📋 RECOMMENDED WORKFLOW:`);
    console.log(`   1. Use --add-year to create basic structure`);
    console.log(`   2. Research accurate dates from official sources`);
    console.log(`   3. Manually edit the JSON file with correct dates`);
    console.log(`   4. Use --validate to check the data`);
    console.log(`   5. Use --generate-sql to create migration`);
  }
}

// CLI interface
if (require.main === module) {
  const updater = new SriLankanHolidayUpdater();
  const args = process.argv.slice(2);

  if (args.includes("--list")) {
    updater.listYears();
  } else if (args.includes("--validate")) {
    updater.validate();
  } else if (args.includes("--add-year")) {
    const yearIndex = args.indexOf("--add-year") + 1;
    const year = parseInt(args[yearIndex]);
    if (year) {
      updater.addYear(year);
      updater.saveHolidayData();
    } else {
      console.log("Please provide a year: --add-year 2029");
    }
  } else if (args.includes("--generate-sql")) {
    const yearIndex = args.indexOf("--generate-sql") + 1;
    const year = parseInt(args[yearIndex]);
    if (year) {
      updater.generateSQL(year);
    } else {
      console.log("Please provide a year: --generate-sql 2029");
    }
  } else if (args.includes("--poya-template")) {
    const yearIndex = args.indexOf("--poya-template") + 1;
    const year = parseInt(args[yearIndex]);
    if (year) {
      updater.getPoyaDayTemplate(year);
    } else {
      console.log("Please provide a year: --poya-template 2029");
    }
  } else if (args.includes("--holiday-info")) {
    updater.showVariableHolidayInfo();
  } else {
    console.log(`
Sri Lankan Holiday Updater

Usage:
  node update-sri-lankan-holidays.js --list                    # List all years
  node update-sri-lankan-holidays.js --validate                # Validate data
  node update-sri-lankan-holidays.js --holiday-info            # Show variable holiday info
  node update-sri-lankan-holidays.js --add-year 2029           # Add basic holidays for year
  node update-sri-lankan-holidays.js --generate-sql 2029       # Generate SQL for year
  node update-sri-lankan-holidays.js --poya-template 2029      # Show complete template for year
    `);
  }
}

module.exports = SriLankanHolidayUpdater;