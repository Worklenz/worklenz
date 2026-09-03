'use strict';
// Backfill migration: Add 2026 Sri Lankan holidays for databases that already ran the initial migration

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Holiday records reference the ISO country code. Older self-hosted schemas
-- did not seed the countries table, so ensure the required reference exists.
INSERT INTO countries (code, name, phone, currency)
VALUES ('LK', 'Sri Lanka', 94, 'LKR')
ON CONFLICT (code) DO NOTHING;

-- Backfill 2026 Sri Lankan holidays (variable holidays from date-holidays library)
INSERT INTO country_holidays (country_code, name, description, date, is_recurring)
VALUES
    ('LK', 'Duruthu Full Moon Poya Day', 'Commemorates the first visit of Buddha to Sri Lanka', '2026-01-03', false),
    ('LK', 'Navam Full Moon Poya Day', 'Commemorates the appointment of Sariputta and Moggallana as Buddha''s chief disciples', '2026-02-01', false),
    ('LK', 'Medin Full Moon Poya Day', 'Commemorates Buddha''s first visit to his father''s palace after enlightenment', '2026-03-02', false),
    ('LK', 'Eid al-Fitr', 'Festival marking the end of Ramadan', '2026-03-21', false),
    ('LK', 'Bak Full Moon Poya Day', 'Commemorates Buddha''s second visit to Sri Lanka', '2026-04-01', false),
    ('LK', 'Good Friday', 'Christian commemoration of the crucifixion of Jesus Christ', '2026-04-03', false),
    ('LK', 'Vesak Full Moon Poya Day', 'Most sacred day for Buddhists - commemorates birth, enlightenment and passing of Buddha', '2026-05-01', false),
    ('LK', 'Day after Vesak Full Moon Poya Day', 'Additional day for Vesak celebrations', '2026-05-02', false),
    ('LK', 'Eid al-Adha', 'Islamic festival of sacrifice', '2026-05-28', false),
    ('LK', 'Poson Full Moon Poya Day', 'Commemorates the introduction of Buddhism to Sri Lanka by Arahat Mahinda', '2026-05-30', false),
    ('LK', 'Esala Full Moon Poya Day', 'Commemorates Buddha''s first sermon and the arrival of the Sacred Tooth Relic', '2026-06-29', false),
    ('LK', 'Nikini Full Moon Poya Day', 'Commemorates the first Buddhist council', '2026-08-27', false),
    ('LK', 'Binara Full Moon Poya Day', 'Commemorates Buddha''s visit to heaven to preach to his mother', '2026-09-26', false),
    ('LK', 'Vap Full Moon Poya Day', 'Marks the end of Buddhist Lent and Buddha''s return from heaven', '2026-10-25', false),
    ('LK', 'Deepavali', 'Hindu Festival of Lights', '2026-11-08', false),
    ('LK', 'Il Full Moon Poya Day', 'Commemorates Buddha''s ordination of sixty disciples', '2026-11-24', false),
    ('LK', 'Unduvap Full Moon Poya Day', 'Commemorates the arrival of Sanghamitta Theri with the Sacred Bo sapling', '2026-12-23', false)
ON CONFLICT (country_code, name, date) DO NOTHING;

-- Ensure fixed holidays for 2026 exist (in case they're missing)
INSERT INTO country_holidays (country_code, name, description, date, is_recurring)
VALUES
    ('LK', 'Independence Day', 'Commemorates the independence of Sri Lanka from British rule in 1948', '2026-02-04', true),
    ('LK', 'Sinhala and Tamil New Year Day', 'Traditional New Year celebrated by Sinhalese and Tamil communities', '2026-04-13', true),
    ('LK', 'Day after Sinhala and Tamil New Year', 'Second day of traditional New Year celebrations', '2026-04-14', true),
    ('LK', 'May Day', 'International Workers'' Day', '2026-05-01', true),
    ('LK', 'Christmas Day', 'Christian celebration of the birth of Jesus Christ', '2026-12-25', true)
ON CONFLICT (country_code, name, date) DO NOTHING;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This is a backfill migration — no automatic rollback defined.
  // Review manually before running migrate:down.
};
