# 🌍 Holiday Calendar System

The Worklenz Holiday Calendar System provides comprehensive holiday management for organizations operating globally.

## 📋 Features

- **200+ Countries Supported** - Comprehensive holiday data for countries worldwide
- **Multiple Holiday Types** - Public, Company, Personal, and Religious holidays
- **Import Country Holidays** - Bulk import official holidays from any supported country
- **Manual Holiday Management** - Add, edit, and delete custom holidays
- **Recurring Holidays** - Support for annual recurring holidays
- **Visual Calendar** - Interactive calendar with color-coded holiday display
- **Dark/Light Mode** - Full theme support

## 🚀 Quick Start

### 1. Database Setup

Run the migration to create the holiday tables:

```bash
# Run the migration
psql -d your_database -f database/migrations/20250130000000-add-holiday-calendar.sql
```

### 2. Populate Country Holidays

Use the npm package to populate holidays for 200+ countries:

```bash
# Run the holiday population script
./scripts/run-holiday-population.sh
```

This will populate holidays for years 2020-2030 for all supported countries.

### 3. Access the Holiday Calendar

Navigate to **Admin Center → Overview** to access the holiday calendar.

## 🌐 Supported Countries

The system includes **200+ countries** across all continents:

### North America
- United States 🇺🇸
- Canada 🇨🇦
- Mexico 🇲🇽

### Europe
- United Kingdom 🇬🇧
- Germany 🇩🇪
- France 🇫🇷
- Italy 🇮🇹
- Spain 🇪🇸
- Netherlands 🇳🇱
- Belgium 🇧🇪
- Switzerland 🇨🇭
- Austria 🇦🇹
- Sweden 🇸🇪
- Norway 🇳🇴
- Denmark 🇩🇰
- Finland 🇫🇮
- Poland 🇵🇱
- Czech Republic 🇨🇿
- Hungary 🇭🇺
- Romania 🇷🇴
- Bulgaria 🇧🇬
- Croatia 🇭🇷
- Slovenia 🇸🇮
- Slovakia 🇸🇰
- Lithuania 🇱🇹
- Latvia 🇱🇻
- Estonia 🇪🇪
- Ireland 🇮🇪
- Portugal 🇵🇹
- Greece 🇬🇷
- Cyprus 🇨🇾
- Malta 🇲🇹
- Luxembourg 🇱🇺
- Iceland 🇮🇸

### Asia
- China 🇨🇳
- Japan 🇯🇵
- South Korea 🇰🇷
- India 🇮🇳
- Pakistan 🇵🇰
- Bangladesh 🇧🇩
- Sri Lanka 🇱🇰
- Nepal 🇳🇵
- Thailand 🇹🇭
- Vietnam 🇻🇳
- Malaysia 🇲🇾
- Singapore 🇸🇬
- Indonesia 🇮🇩
- Philippines 🇵🇭
- Myanmar 🇲🇲
- Cambodia 🇰🇭
- Laos 🇱🇦
- Brunei 🇧🇳
- Timor-Leste 🇹🇱
- Mongolia 🇲🇳
- Kazakhstan 🇰🇿
- Uzbekistan 🇺🇿
- Kyrgyzstan 🇰🇬
- Tajikistan 🇹🇯
- Turkmenistan 🇹🇲
- Afghanistan 🇦🇫
- Iran 🇮🇷
- Iraq 🇮🇶
- Saudi Arabia 🇸🇦
- UAE 🇦🇪
- Qatar 🇶🇦
- Kuwait 🇰🇼
- Bahrain 🇧🇭
- Oman 🇴🇲
- Yemen 🇾🇪
- Jordan 🇯🇴
- Lebanon 🇱🇧
- Syria 🇸🇾
- Israel 🇮🇱
- Palestine 🇵🇸
- Turkey 🇹🇷
- Georgia 🇬🇪
- Armenia 🇦🇲
- Azerbaijan 🇦🇿

### Oceania
- Australia 🇦🇺
- New Zealand 🇳🇿
- Fiji 🇫🇯
- Papua New Guinea 🇵🇬
- Solomon Islands 🇸🇧
- Vanuatu 🇻🇺
- New Caledonia 🇳🇨
- French Polynesia 🇵🇫
- Tonga 🇹🇴
- Samoa 🇼🇸
- Kiribati 🇰🇮
- Tuvalu 🇹🇻
- Nauru 🇳🇷
- Palau 🇵🇼
- Marshall Islands 🇲🇭
- Micronesia 🇫🇲

### Africa
- South Africa 🇿🇦
- Egypt 🇪🇬
- Nigeria 🇳🇬
- Kenya 🇰🇪
- Ethiopia 🇪🇹
- Tanzania 🇹🇿
- Uganda 🇺🇬
- Ghana 🇬🇭
- Ivory Coast 🇨🇮
- Senegal 🇸🇳
- Mali 🇲🇱
- Burkina Faso 🇧🇫
- Niger 🇳🇪
- Chad 🇹🇩
- Cameroon 🇨🇲
- Central African Republic 🇨🇫
- Republic of the Congo 🇨🇬
- Democratic Republic of the Congo 🇨🇩
- Gabon 🇬🇦
- Equatorial Guinea 🇬🇶
- São Tomé and Príncipe 🇸🇹
- Angola 🇦🇴
- Zambia 🇿🇲
- Zimbabwe 🇿🇼
- Botswana 🇧🇼
- Namibia 🇳🇦
- Lesotho 🇱🇸
- Eswatini 🇸🇿
- Madagascar 🇲🇬
- Mauritius 🇲🇺
- Seychelles 🇸🇨
- Comoros 🇰🇲
- Djibouti 🇩🇯
- Somalia 🇸🇴
- Eritrea 🇪🇷
- Sudan 🇸🇩
- South Sudan 🇸🇸
- Libya 🇱🇾
- Tunisia 🇹🇳
- Algeria 🇩🇿
- Morocco 🇲🇦
- Western Sahara 🇪🇭
- Mauritania 🇲🇷
- Gambia 🇬🇲
- Guinea-Bissau 🇬🇼
- Guinea 🇬🇳
- Sierra Leone 🇸🇱
- Liberia 🇱🇷
- Togo 🇹🇬
- Benin 🇧🇯

### South America
- Brazil 🇧🇷
- Argentina 🇦🇷
- Chile 🇨🇱
- Colombia 🇨🇴
- Peru 🇵🇪
- Venezuela 🇻🇪
- Ecuador 🇪🇨
- Bolivia 🇧🇴
- Paraguay 🇵🇾
- Uruguay 🇺🇾
- Guyana 🇬🇾
- Suriname 🇸🇷
- Falkland Islands 🇫🇰
- French Guiana 🇬🇫

### Central America & Caribbean
- Mexico 🇲🇽
- Guatemala 🇬🇹
- Belize 🇧🇿
- El Salvador 🇸🇻
- Honduras 🇭🇳
- Nicaragua 🇳🇮
- Costa Rica 🇨🇷
- Panama 🇵🇦
- Cuba 🇨🇺
- Jamaica 🇯🇲
- Haiti 🇭🇹
- Dominican Republic 🇩🇴
- Puerto Rico 🇵🇷
- Trinidad and Tobago 🇹🇹
- Barbados 🇧🇧
- Grenada 🇬🇩
- Saint Lucia 🇱🇨
- Saint Vincent and the Grenadines 🇻🇨
- Antigua and Barbuda 🇦🇬
- Saint Kitts and Nevis 🇰🇳
- Dominica 🇩🇲
- Bahamas 🇧🇸
- Turks and Caicos Islands 🇹🇨
- Cayman Islands 🇰🇾
- Bermuda 🇧🇲
- Anguilla 🇦🇮
- British Virgin Islands 🇻🇬
- U.S. Virgin Islands 🇻🇮
- Aruba 🇦🇼
- Curaçao 🇨🇼
- Sint Maarten 🇸🇽
- Saint Martin 🇲🇫
- Saint Barthélemy 🇧🇱
- Guadeloupe 🇬🇵
- Martinique 🇲🇶

## 🔧 API Endpoints

### Holiday Types
```http
GET /api/holidays/types
```

### Organization Holidays
```http
GET /api/holidays/organization?year=2024
POST /api/holidays/organization
PUT /api/holidays/organization/:id
DELETE /api/holidays/organization/:id
```

### Country Holidays
```http
GET /api/holidays/countries
GET /api/holidays/countries/:country_code?year=2024
POST /api/holidays/import
```

### Calendar View
```http
GET /api/holidays/calendar?year=2024&month=1
```

## 📊 Holiday Types

The system supports four types of holidays:

1. **Public Holiday** - Official government holidays (Red)
2. **Company Holiday** - Organization-specific holidays (Blue)
3. **Personal Holiday** - Personal or optional holidays (Green)
4. **Religious Holiday** - Religious observances (Yellow)

## 🎯 Usage Examples

### Import US Holidays
```javascript
const result = await holidayApiService.importCountryHolidays({
  country_code: 'US',
  year: 2024
});
```

### Add Custom Holiday
```javascript
const holiday = await holidayApiService.createOrganizationHoliday({
  name: 'Company Retreat',
  description: 'Annual team building event',
  date: '2024-06-15',
  holiday_type_id: 'company-holiday-id',
  is_recurring: true
});
```

### Get Calendar View
```javascript
const calendar = await holidayApiService.getHolidayCalendar(2024, 1);
```

## 🔄 Data Sources

The holiday data is sourced from the `date-holidays` npm package, which provides:

- **Official government holidays** for 200+ countries
- **Religious holidays** (Christian, Islamic, Jewish, Hindu, Buddhist)
- **Cultural and traditional holidays**
- **Historical and commemorative days**

## 🛠️ Maintenance

### Adding New Countries

1. Add the country to the `countries` table
2. Update the `populate-holidays.js` script
3. Run the population script

### Updating Holiday Data

```bash
# Re-run the holiday population script
./scripts/run-holiday-population.sh
```

## 📝 Notes

- Holidays are stored for years 2020-2030 by default
- The system prevents duplicate holidays on the same date
- Imported holidays are automatically classified as "Public Holiday" type
- All holidays support recurring annual patterns
- The calendar view combines organization and country holidays

## 🎉 Benefits

- **Global Compliance** - Ensure compliance with local holiday regulations
- **Resource Planning** - Better project scheduling and resource allocation
- **Team Coordination** - Improved team communication and planning
- **Cost Management** - Accurate billing and time tracking
- **Cultural Awareness** - Respect for diverse cultural and religious practices 