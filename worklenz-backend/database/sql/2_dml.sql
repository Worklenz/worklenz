CREATE OR REPLACE FUNCTION sys_insert_task_priorities() RETURNS VOID AS
$$
BEGIN
    INSERT INTO task_priorities (name, value, color_code, color_code_dark) VALUES ('Medium', 1, '#fbc84c', '#FFC227');
    INSERT INTO task_priorities (name, value, color_code, color_code_dark) VALUES ('Low', 0, '#75c997', '#46D980');
    INSERT INTO task_priorities (name, value, color_code, color_code_dark) VALUES ('High', 2, '#f37070', '#FF4141');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sys_insert_project_access_levels() RETURNS VOID AS
$$
BEGIN
    INSERT INTO project_access_levels (name, key)
    VALUES ('Admin', 'ADMIN');
    INSERT INTO project_access_levels (name, key)
    VALUES ('Member', 'MEMBER');
    INSERT INTO project_access_levels (name, key)
    VALUES ('Project Manager', 'PROJECT_MANAGER');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sys_insert_task_status_categories() RETURNS VOID AS
$$
BEGIN
    INSERT INTO public.sys_task_status_categories (name, color_code, index, is_todo, is_doing, is_done, description,
                                                   color_code_dark)
    VALUES ('To do', '#a9a9a9', 1, TRUE, FALSE, FALSE,
            'For tasks that have not been started.', '#989898');
    INSERT INTO public.sys_task_status_categories (name, color_code, index, is_todo, is_doing, is_done, description,
                                                   color_code_dark)
    VALUES ('Doing', '#70a6f3', 2, FALSE, TRUE, FALSE,
            'For tasks that have been started.', '#4190FF');
    INSERT INTO public.sys_task_status_categories (name, color_code, index, is_todo, is_doing, is_done, description,
                                                   color_code_dark)
    VALUES ('Done', '#75c997', 3, FALSE, FALSE, TRUE,
            'For tasks that have been completed.', '#46D980');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sys_insert_project_statuses() RETURNS VOID AS
$$
BEGIN
    INSERT INTO public.sys_project_statuses (name, color_code, icon, sort_order, is_default)
    VALUES ('Cancelled', '#f37070', 'close-circle', 0, FALSE),
           ('Blocked', '#cbc8a1', 'stop', 1, FALSE),
           ('On Hold', '#cbc8a1', 'stop', 2, FALSE),
           ('Proposed', '#cbc8a1', 'clock-circle', 3, TRUE),
           ('In Planning', '#cbc8a1', 'clock-circle', 4, FALSE),
           ('In Progress', '#80ca79', 'clock-circle', 5, FALSE),
           ('Completed', '#80ca79', 'check-circle', 6, FALSE),
           ('Continuous', '#80ca79', 'clock-circle', 7, FALSE);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sys_insert_project_healths() RETURNS VOID AS
$$
BEGIN
    INSERT INTO sys_project_healths (name, color_code, sort_order, is_default)
    VALUES ('Not Set', '#a9a9a9', 0, TRUE);
    INSERT INTO sys_project_healths (name, color_code, sort_order, is_default)
    VALUES ('Needs Attention', '#fbc84c', 1, FALSE);
    INSERT INTO sys_project_healths (name, color_code, sort_order, is_default)
    VALUES ('At Risk', '#f37070', 2, FALSE);
    INSERT INTO sys_project_healths (name, color_code, sort_order, is_default)
    VALUES ('Good', '#75c997', 3, FALSE);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sys_insert_license_types() RETURNS VOID AS
$$
BEGIN
    INSERT INTO public.sys_license_types (name, key)
        VALUES  ('Custom Subscription', 'CUSTOM'),
                ('Free Trial', 'TRIAL'),
                ('Paddle Subscription', 'PADDLE'),
                ('Credit Subscription', 'CREDIT'),
                ('Free Plan', 'FREE'),
                ('Life Time Deal', 'LIFE_TIME_DEAL'),
                ('Self Hosted', 'SELF_HOSTED');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sys_insert_project_templates() RETURNS VOID AS
$$
DECLARE
    medium_priority_id UUID;
    todo_category_id UUID;
    doing_category_id UUID;
    done_category_id UUID;
BEGIN
    -- Fetch IDs to avoid repeated subqueries
    SELECT id INTO medium_priority_id FROM task_priorities WHERE name = 'Medium' LIMIT 1;
    SELECT id INTO todo_category_id FROM public.sys_task_status_categories WHERE name = 'To do' LIMIT 1;
    SELECT id INTO doing_category_id FROM public.sys_task_status_categories WHERE name = 'Doing' LIMIT 1;
    SELECT id INTO done_category_id FROM public.sys_task_status_categories WHERE name = 'Done' LIMIT 1;

    INSERT INTO public.pt_project_templates (id, name, key, description, phase_label, image_url, color_code)
    VALUES  ('39db59be-1dba-448b-87f4-3b955ea699d2', 'Bug Tracking', 'BT', 'The "Bug Tracking" project template is a versatile solution meticulously designed to streamline and enhance the bug management processes of businesses across diverse industries. This template is especially valuable for organizations that rely on software development, IT services, or digital product management. It provides a structured and efficient approach to tracking, resolving, and improving software issues.', 'Phase', 'https://worklenz.s3.amazonaws.com/project-template-gifs/bug-tracking.gif', '#3b7ad4');

    INSERT INTO public.pt_statuses (id, name, template_id, category_id)
    VALUES  ('c3242606-5a24-48aa-8320-cc90a05c2589', 'To Do', '39db59be-1dba-448b-87f4-3b955ea699d2', todo_category_id),
            ('05ed8d04-92b1-4c44-bd06-abee29641f31', 'Doing', '39db59be-1dba-448b-87f4-3b955ea699d2', doing_category_id),
            ('66e80bc8-6b29-4e72-a484-1593eb1fb44b', 'Done', '39db59be-1dba-448b-87f4-3b955ea699d2', done_category_id);

    INSERT INTO public.pt_tasks (id, name, description, total_minutes, sort_order, priority_id, template_id, parent_task_id, status_id)
    VALUES  ('a75993d9-3fb3-4d0b-a5d4-cab53b60462c', 'Testing and Verification', NULL, 0, 0, medium_priority_id, '39db59be-1dba-448b-87f4-3b955ea699d2', NULL, 'c3242606-5a24-48aa-8320-cc90a05c2589'),
            ('3fdb6801-bc09-4d71-8273-987cd3d1e0f6', 'Bug Prioritization', NULL, 0, 6, medium_priority_id, '39db59be-1dba-448b-87f4-3b955ea699d2', NULL, '05ed8d04-92b1-4c44-bd06-abee29641f31'),
            ('ca64f247-a186-4edb-affd-738f1c2a4d60', 'Bug reporting', NULL, 0, 2, medium_priority_id, '39db59be-1dba-448b-87f4-3b955ea699d2', NULL, 'c3242606-5a24-48aa-8320-cc90a05c2589'),
            ('1e493de8-38cf-4e6e-8f0b-5e1f6f3b07f4', 'Bug Assignment', NULL, 0, 5, medium_priority_id, '39db59be-1dba-448b-87f4-3b955ea699d2', NULL, '05ed8d04-92b1-4c44-bd06-abee29641f31'),
            ('67b2ab3c-53e5-428c-bbad-8bdc19dc88de', 'Bug Closure', NULL, 0, 4, medium_priority_id, '39db59be-1dba-448b-87f4-3b955ea699d2', NULL, '66e80bc8-6b29-4e72-a484-1593eb1fb44b'),
            ('9311ff84-1052-4989-8192-0fea20204fbe', 'Documentation', NULL, 0, 3, medium_priority_id, '39db59be-1dba-448b-87f4-3b955ea699d2', NULL, '66e80bc8-6b29-4e72-a484-1593eb1fb44b'),
            ('7d0697cd-868c-4b41-9f4f-f9a8c1131b24', 'Reporting', NULL, 0, 1, medium_priority_id, '39db59be-1dba-448b-87f4-3b955ea699d2', NULL, '66e80bc8-6b29-4e72-a484-1593eb1fb44b');

    INSERT INTO public.pt_task_phases (task_id, phase_id)
    VALUES  ('a75993d9-3fb3-4d0b-a5d4-cab53b60462c', '4b4a8fe0-4f35-464a-a337-848e5b432ab5'),
            ('3fdb6801-bc09-4d71-8273-987cd3d1e0f6', '557b58ca-3335-4b41-9880-fdd0f990deb9'),
            ('ca64f247-a186-4edb-affd-738f1c2a4d60', '62097027-979f-4b00-afb8-f70fba533f80'),
            ('1e493de8-38cf-4e6e-8f0b-5e1f6f3b07f4', 'e3128891-4873-4795-ad8a-880474280045'),
            ('67b2ab3c-53e5-428c-bbad-8bdc19dc88de', '77204bf3-fcb3-4e39-a843-14458b2f659d'),
            ('9311ff84-1052-4989-8192-0fea20204fbe', '62097027-979f-4b00-afb8-f70fba533f80'),
            ('7d0697cd-868c-4b41-9f4f-f9a8c1131b24', '62097027-979f-4b00-afb8-f70fba533f80');
END;
$$ LANGUAGE plpgsql;


SELECT sys_insert_task_priorities();
SELECT sys_insert_project_access_levels();
SELECT sys_insert_task_status_categories();
SELECT sys_insert_project_statuses();
SELECT sys_insert_project_healths();
SELECT sys_insert_license_types();
-- SELECT sys_insert_project_templates();

DROP FUNCTION sys_insert_task_priorities();
DROP FUNCTION sys_insert_project_access_levels();
DROP FUNCTION sys_insert_task_status_categories();
DROP FUNCTION sys_insert_project_statuses();
DROP FUNCTION sys_insert_project_healths();
DROP FUNCTION sys_insert_license_types();
-- DROP FUNCTION sys_insert_project_templates();

INSERT INTO timezones (name, abbrev, utc_offset)
SELECT name, abbrev, utc_offset
FROM pg_timezone_names;

-- Insert default account setup survey
INSERT INTO surveys (name, description, survey_type, is_active) VALUES 
('Account Setup Survey', 'Initial questionnaire during account setup to understand user needs', 'account_setup', true)
ON CONFLICT DO NOTHING;

-- Insert survey questions for account setup survey
DO $$
DECLARE
    survey_uuid UUID;
BEGIN
    SELECT id INTO survey_uuid FROM surveys WHERE survey_type = 'account_setup' AND name = 'Account Setup Survey' LIMIT 1;
    
    -- Insert survey questions
    INSERT INTO survey_questions (survey_id, question_key, question_type, is_required, sort_order, options) VALUES
    (survey_uuid, 'organization_type', 'single_choice', true, 1, '["freelancer", "startup", "small_medium_business", "agency", "enterprise", "other"]'),
    (survey_uuid, 'user_role', 'single_choice', true, 2, '["founder_ceo", "project_manager", "software_developer", "designer", "operations", "other"]'),
    (survey_uuid, 'main_use_cases', 'multiple_choice', true, 3, '["task_management", "team_collaboration", "resource_planning", "client_communication", "time_tracking", "other"]'),
    (survey_uuid, 'previous_tools', 'text', false, 4, null),
    (survey_uuid, 'how_heard_about', 'single_choice', false, 5, '["google_search", "twitter", "linkedin", "friend_colleague", "blog_article", "other"]')
    ON CONFLICT DO NOTHING;
END $$;
