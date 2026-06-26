# Sri Lankan Holiday Annual Update Process

## Overview
This document outlines the process for annually updating Sri Lankan holiday data to ensure accurate utilization calculations.

## Data Sources & Verification

### Official Government Sources
1. **Central Bank of Sri Lanka**
   - Holiday circulars (usually published in December for the next year)
   - Website: [cbsl.gov.lk](https://www.cbsl.gov.lk)

2. **Department of Meteorology**
   - Astrological calculations for Sinhala & Tamil New Year
   - Website: [meteo.gov.lk](http://www.meteo.gov.lk)

3. **Ministry of Public Administration**
   - Official gazette notifications
   - Public holiday declarations

### Religious Authorities
1. **Buddhist Calendar**
   - Buddhist and Pali University of Sri Lanka
   - Major temples (Malwatte, Asgiriya)

2. **Islamic Calendar**
   - All Ceylon Jamiyyatul Ulama (ACJU)
   - Colombo Grand Mosque

3. **Hindu Calendar**
   - Hindu Cultural Centre
   - Tamil cultural organizations

## Annual Update Workflow

### 1. Preparation (October - November)
```bash
# Check current data status
node update-sri-lankan-holidays.js --list
node update-sri-lankan-holidays.js --validate
```

### 2. Research Phase (November - December)
For the upcoming year (e.g., 2026):

1. **Fixed Holidays** ✅ Already handled
   - Independence Day (Feb 4)
   - May Day (May 1) 
   - Christmas Day (Dec 25)

2. **Variable Holidays** ⚠️ Require verification
   - **Sinhala & Tamil New Year**: Check Department of Meteorology
   - **Poya Days**: Check Buddhist calendar/temples
   - **Good Friday**: Calculate from Easter
   - **Eid al-Fitr & Eid al-Adha**: Check Islamic calendar
   - **Deepavali**: Check Hindu calendar

### 3. Data Collection Template
```bash
# Generate template for the new year
node update-sri-lankan-holidays.js --poya-template 2026
```

This will output a template like:
```json
{
  "name": "Duruthu Full Moon Poya Day",
  "date": "2026-??-??",
  "type": "Poya",
  "description": "Commemorates the first visit of Buddha to Sri Lanka",
  "is_recurring": false
}
```

### 4. Research Checklist

#### Sinhala & Tamil New Year
- [ ] Check Department of Meteorology announcements
- [ ] Verify with astrological authorities
- [ ] Confirm if dates are April 12-13, 13-14, or 14-15

#### Poya Days (12 per year)
- [ ] Get Buddhist calendar for the year
- [ ] Verify with temples or Buddhist authorities
- [ ] Double-check lunar calendar calculations

#### Religious Holidays
- [ ] **Good Friday**: Calculate based on Easter
- [ ] **Eid al-Fitr**: Check Islamic calendar/ACJU
- [ ] **Eid al-Adha**: Check Islamic calendar/ACJU  
- [ ] **Deepavali**: Check Hindu calendar/cultural centers

### 5. Data Entry
1. Edit `src/data/sri-lankan-holidays.json`
2. Add new year section with verified dates
3. Update metadata with sources used

### 6. Validation & Testing
```bash
# Validate the new data
node update-sri-lankan-holidays.js --validate

# Generate SQL for database
node update-sri-lankan-holidays.js --generate-sql 2026
```

### 7. Database Update
1. Create new migration file with the generated SQL
2. Test in development environment
3. Deploy to production

### 8. Documentation
- Update metadata in JSON file
- Document sources used
- Note any special circumstances or date changes

## Emergency Updates

If holidays are announced late or changed:

1. **Quick JSON Update**:
   ```bash
   # Edit the JSON file directly
   # Add the new/changed holiday
   ```

2. **Database Hotfix**:
   ```sql
   INSERT INTO country_holidays (country_code, name, description, date, is_recurring)
   VALUES ('LK', 'Emergency Holiday', 'Description', 'YYYY-MM-DD', false)
   ON CONFLICT (country_code, name, date) DO NOTHING;
   ```

3. **Notify Users**: Consider adding a notification system for holiday changes

## Quality Assurance

### Pre-Release Checklist
- [ ] All 12 Poya days included for the year
- [ ] Sinhala & Tamil New Year dates verified
- [ ] Religious holidays cross-checked with multiple sources
- [ ] No duplicate dates
- [ ] JSON format validation passes
- [ ] Database migration tested

### Post-Release Monitoring
- [ ] Monitor utilization calculations for anomalies
- [ ] Check user feedback for missed holidays
- [ ] Verify against actual government announcements

## Automation Opportunities

Future improvements could include:
1. **API Integration**: Connect to reliable holiday APIs
2. **Web Scraping**: Automated monitoring of official websites
3. **Notification System**: Alert when new holidays are announced
4. **Validation Service**: Cross-check against multiple sources

## Contact Information

For questions about the holiday update process:
- Technical issues: Development team
- Holiday verification: Sri Lankan team members
- Religious holidays: Local community contacts

## Version History

- **v1.0** (2025-01-31): Initial process documentation
- **2025 Data**: Verified and included
- **2026+ Data**: Pending official source verification