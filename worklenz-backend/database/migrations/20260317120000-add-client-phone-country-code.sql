ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS phone_country_code CHAR(2);

