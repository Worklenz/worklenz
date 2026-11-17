'use strict';

exports.up = async pgm => {
  pgm.sql(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE TABLE organization_utilization_thresholds (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
      utilization_optimal_min_threshold_percent INTEGER NOT NULL DEFAULT 90,
      utilization_optimal_max_threshold_percent INTEGER NOT NULL DEFAULT 110,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT organization_utilization_threshold_check CHECK (
        utilization_optimal_min_threshold_percent BETWEEN 1 AND 200 AND
        utilization_optimal_max_threshold_percent BETWEEN 1 AND 200 AND
        utilization_optimal_min_threshold_percent < utilization_optimal_max_threshold_percent)
    );
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'organization_work_policy_settings' AND column_name = 'utilization_optimal_min_threshold_percent')
         AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'organization_work_policy_settings' AND column_name = 'utilization_optimal_max_threshold_percent') THEN
        INSERT INTO organization_utilization_thresholds (organization_id, utilization_optimal_min_threshold_percent, utilization_optimal_max_threshold_percent)
        SELECT organization_id, utilization_optimal_min_threshold_percent, utilization_optimal_max_threshold_percent FROM organization_work_policy_settings;
      END IF;
    END $$;`);
};

exports.down = async pgm => {
  pgm.sql('DROP TABLE IF EXISTS organization_utilization_thresholds;');
};
