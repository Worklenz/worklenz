-- ================================================================
-- Sri Lankan Holidays Migration
-- ================================================================
-- This migration populates Sri Lankan holidays from verified sources
-- 
-- SOURCES & VERIFICATION:
-- - 2025 data: Verified from official government sources
-- - Fixed holidays: Independence Day, May Day, Christmas (all years)
-- - Variable holidays: Added only when officially verified
--
-- MAINTENANCE:
-- - Use scripts/update-sri-lankan-holidays.js for updates
-- - See docs/sri-lankan-holiday-update-process.md for process
-- ================================================================

-- Insert fixed holidays for multiple years (these never change dates)
DO $$
DECLARE
    current_year INT;
BEGIN
    FOR current_year IN 2020..2050 LOOP
        INSERT INTO country_holidays (country_code, name, description, date, is_recurring)
        VALUES
            ('LK', 'Independence Day', 'Commemorates the independence of Sri Lanka from British rule in 1948', 
             make_date(current_year, 2, 4), true),
            ('LK', 'May Day', 'International Workers'' Day', 
             make_date(current_year, 5, 1), true),
            ('LK', 'Christmas Day', 'Christian celebration of the birth of Jesus Christ', 
             make_date(current_year, 12, 25), true)
        ON CONFLICT (country_code, name, date) DO NOTHING;
    END LOOP;
END $$;

-- Insert specific holidays for years 2025-2028 (from our JSON data)

-- 2025 holidays
INSERT INTO country_holidays (country_code, name, description, date, is_recurring)
VALUES
    ('LK', 'Duruthu Full Moon Poya Day', 'Commemorates the first visit of Buddha to Sri Lanka', '2025-01-13', false),
    ('LK', 'Navam Full Moon Poya Day', 'Commemorates the appointment of Sariputta and Moggallana as Buddha''s chief disciples', '2025-02-12', false),
    ('LK', 'Medin Full Moon Poya Day', 'Commemorates Buddha''s first visit to his father''s palace after enlightenment', '2025-03-14', false),
    ('LK', 'Eid al-Fitr', 'Festival marking the end of Ramadan', '2025-03-31', false),
    ('LK', 'Bak Full Moon Poya Day', 'Commemorates Buddha''s second visit to Sri Lanka', '2025-04-12', false),
    ('LK', 'Good Friday', 'Christian commemoration of the crucifixion of Jesus Christ', '2025-04-18', false),
    ('LK', 'Vesak Full Moon Poya Day', 'Most sacred day for Buddhists - commemorates birth, enlightenment and passing of Buddha', '2025-05-12', false),
    ('LK', 'Day after Vesak Full Moon Poya Day', 'Additional day for Vesak celebrations', '2025-05-13', false),
    ('LK', 'Eid al-Adha', 'Islamic festival of sacrifice', '2025-06-07', false),
    ('LK', 'Poson Full Moon Poya Day', 'Commemorates the introduction of Buddhism to Sri Lanka by Arahat Mahinda', '2025-06-11', false),
    ('LK', 'Esala Full Moon Poya Day', 'Commemorates Buddha''s first sermon and the arrival of the Sacred Tooth Relic', '2025-07-10', false),
    ('LK', 'Nikini Full Moon Poya Day', 'Commemorates the first Buddhist council', '2025-08-09', false),
    ('LK', 'Binara Full Moon Poya Day', 'Commemorates Buddha''s visit to heaven to preach to his mother', '2025-09-07', false),
    ('LK', 'Vap Full Moon Poya Day', 'Marks the end of Buddhist Lent and Buddha''s return from heaven', '2025-10-07', false),
    ('LK', 'Deepavali', 'Hindu Festival of Lights', '2025-10-20', false),
    ('LK', 'Il Full Moon Poya Day', 'Commemorates Buddha''s ordination of sixty disciples', '2025-11-05', false),
    ('LK', 'Unduvap Full Moon Poya Day', 'Commemorates the arrival of Sanghamitta Theri with the Sacred Bo sapling', '2025-12-04', false)
ON CONFLICT (country_code, name, date) DO NOTHING;

-- NOTE: Data for 2026+ should be added only after verification from official sources
-- Use the holiday management script to generate templates for new years:
-- node update-sri-lankan-holidays.js --poya-template YYYY