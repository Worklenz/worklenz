const Holidays = require("date-holidays");
const { Pool } = require("pg");
const config = require("../build/config/db-config").default;

// Database connection
const pool = new Pool(config);

// Countries to populate with holidays
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
  { code: "PK", name: "Pakistan" },
  { code: "BD", name: "Bangladesh" },
  { code: "LK", name: "Sri Lanka" },
  { code: "NP", name: "Nepal" },
  { code: "TH", name: "Thailand" },
  { code: "VN", name: "Vietnam" },
  { code: "MY", name: "Malaysia" },
  { code: "SG", name: "Singapore" },
  { code: "ID", name: "Indonesia" },
  { code: "PH", name: "Philippines" },
  { code: "MM", name: "Myanmar" },
  { code: "KH", name: "Cambodia" },
  { code: "LA", name: "Laos" },
  { code: "BN", name: "Brunei" },
  { code: "TL", name: "Timor-Leste" },
  { code: "MN", name: "Mongolia" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "UZ", name: "Uzbekistan" },
  { code: "KG", name: "Kyrgyzstan" },
  { code: "TJ", name: "Tajikistan" },
  { code: "TM", name: "Turkmenistan" },
  { code: "AF", name: "Afghanistan" },
  { code: "IR", name: "Iran" },
  { code: "IQ", name: "Iraq" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "QA", name: "Qatar" },
  { code: "KW", name: "Kuwait" },
  { code: "BH", name: "Bahrain" },
  { code: "OM", name: "Oman" },
  { code: "YE", name: "Yemen" },
  { code: "JO", name: "Jordan" },
  { code: "LB", name: "Lebanon" },
  { code: "SY", name: "Syria" },
  { code: "IL", name: "Israel" },
  { code: "PS", name: "Palestine" },
  { code: "TR", name: "Turkey" },
  { code: "GE", name: "Georgia" },
  { code: "AM", name: "Armenia" },
  { code: "AZ", name: "Azerbaijan" },
  { code: "NZ", name: "New Zealand" },
  { code: "FJ", name: "Fiji" },
  { code: "PG", name: "Papua New Guinea" },
  { code: "SB", name: "Solomon Islands" },
  { code: "VU", name: "Vanuatu" },
  { code: "NC", name: "New Caledonia" },
  { code: "PF", name: "French Polynesia" },
  { code: "TO", name: "Tonga" },
  { code: "WS", name: "Samoa" },
  { code: "KI", name: "Kiribati" },
  { code: "TV", name: "Tuvalu" },
  { code: "NR", name: "Nauru" },
  { code: "PW", name: "Palau" },
  { code: "MH", name: "Marshall Islands" },
  { code: "FM", name: "Micronesia" },
  { code: "ZA", name: "South Africa" },
  { code: "EG", name: "Egypt" },
  { code: "NG", name: "Nigeria" },
  { code: "KE", name: "Kenya" },
  { code: "ET", name: "Ethiopia" },
  { code: "TZ", name: "Tanzania" },
  { code: "UG", name: "Uganda" },
  { code: "GH", name: "Ghana" },
  { code: "CI", name: "Ivory Coast" },
  { code: "SN", name: "Senegal" },
  { code: "ML", name: "Mali" },
  { code: "BF", name: "Burkina Faso" },
  { code: "NE", name: "Niger" },
  { code: "TD", name: "Chad" },
  { code: "CM", name: "Cameroon" },
  { code: "CF", name: "Central African Republic" },
  { code: "CG", name: "Republic of the Congo" },
  { code: "CD", name: "Democratic Republic of the Congo" },
  { code: "GA", name: "Gabon" },
  { code: "GQ", name: "Equatorial Guinea" },
  { code: "ST", name: "São Tomé and Príncipe" },
  { code: "AO", name: "Angola" },
  { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" },
  { code: "BW", name: "Botswana" },
  { code: "NA", name: "Namibia" },
  { code: "LS", name: "Lesotho" },
  { code: "SZ", name: "Eswatini" },
  { code: "MG", name: "Madagascar" },
  { code: "MU", name: "Mauritius" },
  { code: "SC", name: "Seychelles" },
  { code: "KM", name: "Comoros" },
  { code: "DJ", name: "Djibouti" },
  { code: "SO", name: "Somalia" },
  { code: "ER", name: "Eritrea" },
  { code: "SD", name: "Sudan" },
  { code: "SS", name: "South Sudan" },
  { code: "LY", name: "Libya" },
  { code: "TN", name: "Tunisia" },
  { code: "DZ", name: "Algeria" },
  { code: "MA", name: "Morocco" },
  { code: "EH", name: "Western Sahara" },
  { code: "MR", name: "Mauritania" },
  { code: "GM", name: "Gambia" },
  { code: "GW", name: "Guinea-Bissau" },
  { code: "GN", name: "Guinea" },
  { code: "SL", name: "Sierra Leone" },
  { code: "LR", name: "Liberia" },
  { code: "TG", name: "Togo" },
  { code: "BJ", name: "Benin" },
  { code: "BR", name: "Brazil" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "PE", name: "Peru" },
  { code: "VE", name: "Venezuela" },
  { code: "EC", name: "Ecuador" },
  { code: "BO", name: "Bolivia" },
  { code: "PY", name: "Paraguay" },
  { code: "UY", name: "Uruguay" },
  { code: "GY", name: "Guyana" },
  { code: "SR", name: "Suriname" },
  { code: "FK", name: "Falkland Islands" },
  { code: "GF", name: "French Guiana" },
  { code: "MX", name: "Mexico" },
  { code: "GT", name: "Guatemala" },
  { code: "BZ", name: "Belize" },
  { code: "SV", name: "El Salvador" },
  { code: "HN", name: "Honduras" },
  { code: "NI", name: "Nicaragua" },
  { code: "CR", name: "Costa Rica" },
  { code: "PA", name: "Panama" },
  { code: "CU", name: "Cuba" },
  { code: "JM", name: "Jamaica" },
  { code: "HT", name: "Haiti" },
  { code: "DO", name: "Dominican Republic" },
  { code: "PR", name: "Puerto Rico" },
  { code: "TT", name: "Trinidad and Tobago" },
  { code: "BB", name: "Barbados" },
  { code: "GD", name: "Grenada" },
  { code: "LC", name: "Saint Lucia" },
  { code: "VC", name: "Saint Vincent and the Grenadines" },
  { code: "AG", name: "Antigua and Barbuda" },
  { code: "KN", name: "Saint Kitts and Nevis" },
  { code: "DM", name: "Dominica" },
  { code: "BS", name: "Bahamas" },
  { code: "TC", name: "Turks and Caicos Islands" },
  { code: "KY", name: "Cayman Islands" },
  { code: "BM", name: "Bermuda" },
  { code: "AI", name: "Anguilla" },
  { code: "VG", name: "British Virgin Islands" },
  { code: "VI", name: "U.S. Virgin Islands" },
  { code: "AW", name: "Aruba" },
  { code: "CW", name: "Curaçao" },
  { code: "SX", name: "Sint Maarten" },
  { code: "MF", name: "Saint Martin" },
  { code: "BL", name: "Saint Barthélemy" },
  { code: "GP", name: "Guadeloupe" },
  { code: "MQ", name: "Martinique" }
];

async function populateHolidays() {
  const client = await pool.connect();
  
  try {
    console.log("Starting holiday population...");
    
    for (const country of countries) {
      console.log(`Processing ${country.name} (${country.code})...`);
      
      try {
        const hd = new Holidays(country.code);
        
        // Get holidays for multiple years (2020-2030)
        for (let year = 2020; year <= 2030; year++) {
          const holidays = hd.getHolidays(year);
          
          for (const holiday of holidays) {
            // Skip if holiday is not a date object
            if (!holiday.date || typeof holiday.date !== "object") {
              continue;
            }
            
            const dateStr = holiday.date.toISOString().split("T")[0];
            const name = holiday.name || "Unknown Holiday";
            const description = holiday.type || "Public Holiday";
            
            // Insert holiday into database
            const query = `
              INSERT INTO country_holidays (country_code, name, description, date, is_recurring)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (country_code, name, date) DO NOTHING
            `;
            
            await client.query(query, [
              country.code,
              name,
              description,
              dateStr,
              true // Most holidays are recurring
            ]);
          }
        }
        
        console.log(`✓ Completed ${country.name}`);
        
      } catch (error) {
        console.log(`✗ Error processing ${country.name}: ${error.message}`);
      }
    }
    
    console.log("Holiday population completed!");
    
  } catch (error) {
    console.error("Database error:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
populateHolidays().catch(console.error); 