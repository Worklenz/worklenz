-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS permissions_name_uindex
    ON permissions (name);

CREATE UNIQUE INDEX IF NOT EXISTS bounced_emails_email_uindex
    ON bounced_emails (email);

CREATE INDEX IF NOT EXISTS clients_id_team_id_index
    ON clients (id, team_id);

CREATE UNIQUE INDEX IF NOT EXISTS clients_name_team_id_uindex
    ON clients (name, team_id);

CREATE UNIQUE INDEX IF NOT EXISTS cpt_phases_name_project_uindex
    ON cpt_phases (name, template_id);

CREATE UNIQUE INDEX IF NOT EXISTS cpt_task_phase_cpt_task_phase_uindex
    ON cpt_task_phases (task_id, phase_id);

CREATE UNIQUE INDEX IF NOT EXISTS cpt_task_phase_task_id_uindex
    ON cpt_task_phases (task_id);

CREATE UNIQUE INDEX IF NOT EXISTS cpt_task_statuses_template_id_name_uindex
    ON cpt_task_statuses (template_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS custom_project_templates_name_team_id_uindex
    ON custom_project_templates (name, team_id);

CREATE UNIQUE INDEX IF NOT EXISTS job_titles_name_team_id_uindex
    ON job_titles (name, team_id);

CREATE INDEX IF NOT EXISTS job_titles_team_id_index
    ON job_titles (team_id);

CREATE UNIQUE INDEX IF NOT EXISTS licensing_coupon_codes_coupon_code_uindex
    ON licensing_coupon_codes (coupon_code);

CREATE INDEX IF NOT EXISTS licensing_coupon_codes_redeemed_by_index
    ON licensing_coupon_codes (redeemed_by);

CREATE UNIQUE INDEX IF NOT EXISTS licensing_pricing_plans_uindex
    ON licensing_pricing_plans (id);

CREATE UNIQUE INDEX IF NOT EXISTS licensing_user_plans_uindex
    ON licensing_user_subscriptions (id);

CREATE INDEX IF NOT EXISTS licensing_user_subscriptions_user_id_index
    ON licensing_user_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS notification_settings_team_user_id_index
    ON notification_settings (team_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS personal_todo_list_index_uindex
    ON personal_todo_list (user_id, index);

CREATE UNIQUE INDEX IF NOT EXISTS project_categories_name_team_id_uindex
    ON project_categories (name, team_id);

CREATE INDEX IF NOT EXISTS project_comments_project_id_index
    ON project_comments (project_id);

CREATE UNIQUE INDEX IF NOT EXISTS project_folders_team_id_key_uindex
    ON project_folders (team_id, key);

CREATE UNIQUE INDEX IF NOT EXISTS project_folders_team_id_name_uindex
    ON project_folders (team_id, name);

CREATE INDEX IF NOT EXISTS project_members_project_id_index
    ON project_members (project_id);

CREATE INDEX IF NOT EXISTS project_members_project_id_member_id_index
    ON project_members (project_id, team_member_id);

CREATE INDEX IF NOT EXISTS project_members_team_member_id_index
    ON project_members (team_member_id);

CREATE UNIQUE INDEX IF NOT EXISTS project_members_team_member_project_uindex
    ON project_members (team_member_id, project_id);

CREATE UNIQUE INDEX IF NOT EXISTS project_phases_name_project_uindex
    ON project_phases (name, project_id);

CREATE UNIQUE INDEX IF NOT EXISTS project_subscribers_user_task_team_member_uindex
    ON project_subscribers (user_id, project_id, team_member_id);

CREATE INDEX IF NOT EXISTS project_task_list_cols_index
    ON project_task_list_cols (project_id, index);

CREATE UNIQUE INDEX IF NOT EXISTS project_task_list_cols_key_project_uindex
    ON project_task_list_cols (key, project_id);

CREATE INDEX IF NOT EXISTS projects_folder_id_index
    ON projects (folder_id);

CREATE INDEX IF NOT EXISTS projects_id_team_id_index
    ON projects (id, team_id);

CREATE UNIQUE INDEX IF NOT EXISTS projects_key_team_id_uindex
    ON projects (key, team_id);

CREATE INDEX IF NOT EXISTS projects_name_index
    ON projects (name);

CREATE UNIQUE INDEX IF NOT EXISTS projects_name_team_id_uindex
    ON projects (name, team_id);

CREATE INDEX IF NOT EXISTS projects_team_id_folder_id_index
    ON projects (team_id, folder_id);

CREATE INDEX IF NOT EXISTS projects_team_id_index
    ON projects (team_id);

CREATE INDEX IF NOT EXISTS projects_team_id_name_index
    ON projects (team_id, name);

