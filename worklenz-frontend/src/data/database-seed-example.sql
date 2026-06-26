-- Sri Lankan Holidays Database Seed for 2025
-- This SQL can be used to populate your holidays table with Sri Lankan holidays
-- Adjust table/column names according to your database schema

-- Create holidays table if it doesn't exist (example schema)
CREATE TABLE IF NOT EXISTS holidays (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  is_poya BOOLEAN DEFAULT FALSE,
  country_code CHAR(2) NOT NULL,
  color_code VARCHAR(7),
  source VARCHAR(50) DEFAULT 'official',
  is_editable BOOLEAN DEFAULT FALSE,
  organization_id INTEGER, -- Link to organization if holidays are org-specific
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert Sri Lankan holidays for 2025
INSERT INTO holidays (name, date, type, description, is_recurring, is_poya, country_code, color_code, source, is_editable)
VALUES
  -- January
  ('New Year''s Day', '2025-01-01', 'Public', 'Celebration of the first day of the Gregorian calendar year', true, false, 'LK', '#DC143C', 'official', false),
  ('Duruthu Full Moon Poya Day', '2025-01-13', 'Poya', 'Commemorates the first visit of Buddha to Sri Lanka', false, true, 'LK', '#8B4513', 'official', false),
  
  -- February
  ('Independence Day', '2025-02-04', 'Public', 'Commemorates the independence of Sri Lanka from British rule in 1948', true, false, 'LK', '#DC143C', 'official', false),
  ('Navam Full Moon Poya Day', '2025-02-12', 'Poya', 'Commemorates the appointment of Sariputta and Moggallana as Buddha''s chief disciples', false, true, 'LK', '#8B4513', 'official', false),
  
  -- March
  ('Medin Full Moon Poya Day', '2025-03-14', 'Poya', 'Commemorates Buddha''s first visit to his father''s palace after enlightenment', false, true, 'LK', '#8B4513', 'official', false),
  ('Eid al-Fitr', '2025-03-31', 'Public', 'Festival marking the end of Ramadan', false, false, 'LK', '#DC143C', 'official', false),
  
  -- April
  ('Bak Full Moon Poya Day', '2025-04-12', 'Poya', 'Commemorates Buddha''s second visit to Sri Lanka', false, true, 'LK', '#8B4513', 'official', false),
  ('Sinhala and Tamil New Year Day', '2025-04-13', 'Public', 'Traditional New Year celebrated by Sinhalese and Tamil communities', true, false, 'LK', '#DC143C', 'official', false),
  ('Day after Sinhala and Tamil New Year', '2025-04-14', 'Public', 'Second day of traditional New Year celebrations', true, false, 'LK', '#DC143C', 'official', false),
  ('Good Friday', '2025-04-18', 'Public', 'Christian commemoration of the crucifixion of Jesus Christ', false, false, 'LK', '#DC143C', 'official', false),
  
  -- May
  ('May Day', '2025-05-01', 'Public', 'International Workers'' Day', true, false, 'LK', '#DC143C', 'official', false),
  ('Vesak Full Moon Poya Day', '2025-05-12', 'Poya', 'Most sacred day for Buddhists - commemorates birth, enlightenment and passing of Buddha', false, true, 'LK', '#8B4513', 'official', false),
  ('Day after Vesak Full Moon Poya Day', '2025-05-13', 'Public', 'Additional day for Vesak celebrations', false, false, 'LK', '#DC143C', 'official', false),
  
  -- June
  ('Poson Full Moon Poya Day', '2025-06-11', 'Poya', 'Commemorates the introduction of Buddhism to Sri Lanka by Arahat Mahinda', false, true, 'LK', '#8B4513', 'official', false),
  
  -- July
  ('Esala Full Moon Poya Day', '2025-07-10', 'Poya', 'Commemorates Buddha''s first sermon and the arrival of the Sacred Tooth Relic', false, true, 'LK', '#8B4513', 'official', false),
  
  -- August
  ('Nikini Full Moon Poya Day', '2025-08-09', 'Poya', 'Commemorates the first Buddhist council', false, true, 'LK', '#8B4513', 'official', false),
  
  -- September
  ('Binara Full Moon Poya Day', '2025-09-07', 'Poya', 'Commemorates Buddha''s visit to heaven to preach to his mother', false, true, 'LK', '#8B4513', 'official', false),
  
  -- October
  ('Vap Full Moon Poya Day', '2025-10-07', 'Poya', 'Marks the end of Buddhist Lent and Buddha''s return from heaven', false, true, 'LK', '#8B4513', 'official', false),
  ('Deepavali', '2025-10-20', 'Public', 'Hindu Festival of Lights', false, false, 'LK', '#DC143C', 'official', false),
  
  -- November
  ('Il Full Moon Poya Day', '2025-11-05', 'Poya', 'Commemorates Buddha''s ordination of sixty disciples', false, true, 'LK', '#8B4513', 'official', false),
  
  -- December
  ('Unduvap Full Moon Poya Day', '2025-12-04', 'Poya', 'Commemorates the arrival of Sanghamitta Theri with the Sacred Bo sapling', false, true, 'LK', '#8B4513', 'official', false),
  ('Christmas Day', '2025-12-25', 'Public', 'Christian celebration of the birth of Jesus Christ', true, false, 'LK', '#DC143C', 'official', false);

-- Create index for performance
CREATE INDEX idx_holidays_country_date ON holidays(country_code, date);
CREATE INDEX idx_holidays_type ON holidays(type);

-- Example: Link holidays to all Sri Lankan organizations
-- UPDATE holidays SET organization_id = organizations.id 
-- FROM organizations 
-- WHERE organizations.country_code = 'LK' AND holidays.country_code = 'LK';

-- Verify insertion
SELECT type, COUNT(*) as count 
FROM holidays 
WHERE country_code = 'LK' AND EXTRACT(YEAR FROM date) = 2025
GROUP BY type;

-- Expected output:
-- type     | count
-- ---------|-------
-- Public   | 10
-- Poya     | 12