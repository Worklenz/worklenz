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
    VALUES  ('0a769952-e9b8-4e48-b562-f4ebb0f5914e', 'Software Development', 'SD', 'The "Software Development" project template is a specialized and comprehensive template tailored to the unique needs of software development teams and companies. It offers a structured framework for planning, tracking, and executing software development projects, making it an essential resource for software development firms, tech startups, IT departments, and any business involved in software product development.', 'Phase', 'https://worklenz.s3.amazonaws.com/project-template-gifs/software-developement.gif', '#3b7ad4'),
            ('c73b8eaf-9a07-4d89-a7e7-84cd2fd4e9f0', 'Design & Creative', 'DC', 'The "Design & Creative" project template is a versatile solution meticulously crafted to support and enhance the creative and design processes of businesses across various industries. It offers a structured and efficient approach to managing design and creative projects.\r\n', 'Phase', 'https://worklenz.s3.amazonaws.com/project-template-gifs/creative-and-designing.gif', '#3b7ad4'),
            ('f25549d0-d5de-46aa-bbd5-eaab7a970799', 'HR & Recruiting', 'HR', 'The "HR & Recruiting" project template is a specialized tool designed to streamline and enhance human resources and talent acquisition processes. This template is essential for businesses and organizations of all sizes and industries that are involved in HR management and recruitment activities. It provides a structured approach to managing HR projects, making it suitable for a diverse range of businesses.', 'Phase', 'https://worklenz.s3.amazonaws.com/project-template-gifs/hr.gif', '#3b7ad4'),
            ('22805d87-ba25-4b2a-8384-7a4eeedc3b63', 'Information Technology', 'IT', 'The "Information Technology" project template is a comprehensive framework tailored to meet the unique needs of businesses and organizations operating in the field of technology and IT services. This versatile template is designed to facilitate the management of IT-related projects, making it applicable to a wide range of businesses.', 'Phase', 'https://worklenz.s3.amazonaws.com/project-template-gifs/information-technology.gif', '#3b7ad4'),
            ('a014fae0-1b70-4c05-96b4-1fa8c54591b0', 'Finance', 'FIN', 'The "Finance" project template is a strategic tool meticulously designed to guide businesses and financial professionals in managing critical financial processes, making it applicable to a wide range of industries and businesses. This template provides a structured approach to financial planning, decision-making, and review, making it valuable for various types of organizations.\r\n', 'Phase', 'https://worklenz.s3.amazonaws.com/project-template-gifs/finance.gif', '#3b7ad4'),
            ('e71b3b9b-31a8-47ae-84d8-6dc2ae62e06a', 'Personal use', 'PU', 'The "Personal Use" project template is a versatile and user-centric template designed to help individuals manage their personal projects, tasks, and goals with efficiency and organization. This template is adaptable for a wide range of personal activities and can be utilized by anyone seeking a structured approach to planning, tracking, and completing their personal endeavors.', 'Phase', 'https://worklenz.s3.amazonaws.com/project-template-gifs/personal-use.gif', '#3b7ad4'),
            ('0aa3f6fc-678f-4d17-8df2-9674ca81fad2', 'Legal', 'LEG', 'The "Legal" project template is a specialized framework meticulously designed to facilitate organized and efficient management of legal projects and matters. This versatile template is essential for businesses, legal departments, and law firms involved in legal activities, making it applicable to a wide range of industries and organizations', 'Phase', 'https://worklenz.s3.amazonaws.com/project-template-gifs/legal.gif', '#3b7ad4'),
            ('5d1ffd21-a7b7-4a5a-9d19-f7fd3ee253e7', 'Nonprofit', 'NON', 'The "Nonprofit" project template is a purpose-built solution tailored to the unique needs and challenges faced by organizations dedicated to serving a greater social or community cause. It provides a structured framework for planning, executing, and monitoring nonprofit initiatives, making it an ideal template for nonprofit organizations, charities, foundations, and community groups.', 'Phase', 'https://worklenz.s3.amazonaws.com/project-template-gifs/non-profit.gif', '#3b7ad4'),
            ('39db59be-1dba-448b-87f4-3b955ea699d2', 'Bug Tracking', 'BT', 'The "Bug Tracking" project template is a versatile solution meticulously designed to streamline and enhance the bug management processes of businesses across diverse industries. This template is especially valuable for organizations that rely on software development, IT services, or digital product management. It provides a structured and efficient approach to tracking, resolving, and improving software issues.', 'Phase', 'https://worklenz.s3.amazonaws.com/project-template-gifs/bug-tracking.gif', '#3b7ad4'),
            ('d1baf96f-07f4-4468-bb4f-44cdedfad965', 'Manufacturing', 'MAN', 'The "Manufacturing" project template is a specialized and comprehensive template designed to facilitate the management of manufacturing processes and product development from conception to production. This template provides a structured framework for planning, prototyping, and manufacturing, making it essential for manufacturing companies, product design firms, startups, and organizations involved in the development and production of physical products.', 'Phase', 'https://worklenz.s3.amazonaws.com/project-template-gifs/maufacturing.gif', '#3b7ad4'),
            ('d90f9194-200a-4afa-a896-ee5afda2cc8a', 'Construction', 'CON', 'The "Construction" project template is a comprehensive solution designed to facilitate efficient project execution for businesses operating in the construction industry. This template offers a structured approach to managing various aspects of construction projects.\r\n', 'Phase', 'https://worklenz.s3.amazonaws.com/project-template-gifs/construction.gif', '#3b7ad4'),
            ('bdf32f36-e85b-434f-aeda-dde2e8ade8c7', 'Sales & CRM', 'SC', 'The "Sales & CRM" project template is a comprehensive solution designed to optimize sales processes and enhance customer relationship management for businesses across various industries. It provides a structured framework for tracking leads, opportunities, and customer interactions, making it an invaluable template for sales-driven organizations and businesses aiming to foster strong customer relationships.', 'Phase', 'https://worklenz.s3.amazonaws.com/project-template-gifs/sales.gif', '#3b7ad4'),
            ('c86ed436-f9af-4332-8a2d-2afe9a6d66d4', 'Education', 'EDU', 'The "Education" project template is a dynamic tool designed to facilitate organized and effective management of educational initiatives and projects. This versatile template can be utilized by a variety of educational institutions and businesses involved in the field of education\r\n', 'Phase', 'https://worklenz.s3.amazonaws.com/project-template-gifs/education.gif', '#3b7ad4'),
            ('c94c7306-73ab-4e17-bad4-0e7ff4a9da09', 'Services & Consulting', 'SCE', 'The "Services & Consulting" project template is a robust and versatile template designed to facilitate the efficient delivery of services, consulting engagements, and project-based work across various industries. This template offers a structured framework for managing projects from initiation to closure, making it an invaluable resource for service providers, consulting firms, and businesses engaged in project-driven activities.', 'Phase', 'https://worklenz.s3.amazonaws.com/project-template-gifs/services.gif', '#3b7ad4'),
            ('c6917d57-f84a-40fc-aff0-70fd0aab951f', 'Marketing', 'MAR', 'The "Marketing" project template is a versatile and essential template designed to streamline and manage marketing initiatives and campaigns across various industries and business types. This template offers a structured framework for planning, executing, and evaluating marketing projects, making it invaluable for marketing agencies, in-house marketing teams, e-commerce businesses, startups, and organizations seeking to enhance their marketing efforts.', 'Phase', 'https://worklenz.s3.amazonaws.com/project-template-gifs/marketing.gif', '#3b7ad4');

    INSERT INTO public.pt_statuses (id, name, template_id, category_id)
    VALUES  ('c3242606-5a24-48aa-8320-cc90a05c2589', 'To Do', '39db59be-1dba-448b-87f4-3b955ea699d2', todo_category_id),
            ('05ed8d04-92b1-4c44-bd06-abee29641f31', 'Doing', '39db59be-1dba-448b-87f4-3b955ea699d2', doing_category_id),
            ('66e80bc8-6b29-4e72-a484-1593eb1fb44b', 'Done', '39db59be-1dba-448b-87f4-3b955ea699d2', done_category_id),
            ('d8a7ac27-cdfb-48fe-b8cd-c87128269a93', 'To Do', 'd90f9194-200a-4afa-a896-ee5afda2cc8a', todo_category_id),
            ('a83565f9-2c22-486a-8c10-59182bfe19c6', 'Doing', 'd90f9194-200a-4afa-a896-ee5afda2cc8a', doing_category_id),
            ('78803d54-ee61-4389-a5c2-c676f1007d75', 'Done', 'd90f9194-200a-4afa-a896-ee5afda2cc8a', done_category_id),
            ('70cbcea9-2b3c-453a-af0d-fb8a7f6270fd', 'To Do', 'c73b8eaf-9a07-4d89-a7e7-84cd2fd4e9f0', todo_category_id),
            ('bf37bf58-c0d1-498f-b208-c9e80509a593', 'Doing', 'c73b8eaf-9a07-4d89-a7e7-84cd2fd4e9f0', doing_category_id),
            ('c7384096-7008-4eb4-b95f-c0706b9647d6', 'Done', 'c73b8eaf-9a07-4d89-a7e7-84cd2fd4e9f0', done_category_id),
            ('efdb40e7-78ae-4a5a-83ec-d372a5816ae5', 'To Do', 'c86ed436-f9af-4332-8a2d-2afe9a6d66d4', todo_category_id),
            ('ca81d57d-b7d2-45fc-adcd-1c926fd93e6c', 'Doing', 'c86ed436-f9af-4332-8a2d-2afe9a6d66d4', doing_category_id),
            ('e6dffb96-6879-4064-ab8f-73ca784b1964', 'Done', 'c86ed436-f9af-4332-8a2d-2afe9a6d66d4', done_category_id),
            ('0010ae09-0dd6-4c08-b351-30124e0dc436', 'To Do', 'a014fae0-1b70-4c05-96b4-1fa8c54591b0', todo_category_id),
            ('bde5228a-23b9-4f9d-87fe-1784311d68f6', 'Doing', 'a014fae0-1b70-4c05-96b4-1fa8c54591b0', doing_category_id),
            ('5b01b5bd-f29e-477d-94a6-dc5b8101db37', 'Done', 'a014fae0-1b70-4c05-96b4-1fa8c54591b0', done_category_id),
            ('35430ef9-040f-465f-b5e3-1f33b26124dd', 'To Do', 'f25549d0-d5de-46aa-bbd5-eaab7a970799', todo_category_id),
            ('bac101f9-cec3-43aa-8bd8-354de42fdff2', 'Doing', 'f25549d0-d5de-46aa-bbd5-eaab7a970799', doing_category_id),
            ('400b58bd-ad09-4cd1-b5bd-a9f7cb46cb47', 'Done', 'f25549d0-d5de-46aa-bbd5-eaab7a970799', done_category_id),
            ('8e9cc873-d9a5-404f-9f38-8ca4fba91a0d', 'To Do', '22805d87-ba25-4b2a-8384-7a4eeedc3b63', todo_category_id),
            ('856cd7b1-76b1-4182-b2c8-60c278839913', 'Doing', '22805d87-ba25-4b2a-8384-7a4eeedc3b63', doing_category_id),
            ('cbf86a20-8b6d-43d0-99d7-523fb600cdac', 'Done', '22805d87-ba25-4b2a-8384-7a4eeedc3b63', done_category_id),
            ('6f0f7261-7f1a-40f3-a771-04fbc5cd0059', 'To Do', '0aa3f6fc-678f-4d17-8df2-9674ca81fad2', todo_category_id),
            ('54452070-d355-4fb2-b416-e57390d1b668', 'Doing', '0aa3f6fc-678f-4d17-8df2-9674ca81fad2', doing_category_id),
            ('8aac89fc-cf0c-4a4e-889b-97ccd8e7af94', 'Done', '0aa3f6fc-678f-4d17-8df2-9674ca81fad2', done_category_id),
            ('0c3c5259-70d2-407b-8a45-c9b81ac84a3a', 'To Do', 'd1baf96f-07f4-4468-bb4f-44cdedfad965', todo_category_id),
            ('61cf7147-4416-4efb-bda7-4db1059f76a9', 'Doing', 'd1baf96f-07f4-4468-bb4f-44cdedfad965', doing_category_id),
            ('65f4cbd7-bcbb-4a10-8014-fd3b9a3c9ed9', 'Done', 'd1baf96f-07f4-4468-bb4f-44cdedfad965', done_category_id),
            ('1073754d-c498-4e6d-bcee-68bba526e572', 'To Do', 'c6917d57-f84a-40fc-aff0-70fd0aab951f', todo_category_id),
            ('44d54c08-bce6-44e6-9cfc-23d1b4a9e011', 'Doing', 'c6917d57-f84a-40fc-aff0-70fd0aab951f', doing_category_id),
            ('1ae23b11-5edf-485d-9217-f905dc33ddda', 'Done', 'c6917d57-f84a-40fc-aff0-70fd0aab951f', done_category_id),
            ('da60606a-ced5-46bf-bf2f-4ee9d5627a9a', 'To Do', '5d1ffd21-a7b7-4a5a-9d19-f7fd3ee253e7', todo_category_id),
            ('d2bff598-5135-4cac-92aa-641b69ae1dab', 'Doing', '5d1ffd21-a7b7-4a5a-9d19-f7fd3ee253e7', doing_category_id),
            ('9ec60343-27fe-4af5-a35b-d356ebd61837', 'Done', '5d1ffd21-a7b7-4a5a-9d19-f7fd3ee253e7', done_category_id),
            ('2e14a9e9-4c1a-4596-a0f2-574d2e7b2fa4', 'To Do', 'e71b3b9b-31a8-47ae-84d8-6dc2ae62e06a', todo_category_id),
            ('1a403c75-5d8c-4752-bf96-e486b8042df6', 'Doing', 'e71b3b9b-31a8-47ae-84d8-6dc2ae62e06a', doing_category_id),
            ('70fd7f98-b278-440a-8a33-d3453bfd4b70', 'Done', 'e71b3b9b-31a8-47ae-84d8-6dc2ae62e06a', done_category_id),
            ('c20816ac-fe57-4471-91b0-61fa060663ca', 'To Do', 'bdf32f36-e85b-434f-aeda-dde2e8ade8c7', todo_category_id),
            ('291095da-b3d9-40aa-bcd2-5cd6fb51b89f', 'Doing', 'bdf32f36-e85b-434f-aeda-dde2e8ade8c7', doing_category_id),
            ('b450e432-63f4-46a9-bd4a-26b0bdd37507', 'Done', 'bdf32f36-e85b-434f-aeda-dde2e8ade8c7', done_category_id),
            ('4da7cb15-9767-4522-9950-6a4b26e660a6', 'To Do', 'c94c7306-73ab-4e17-bad4-0e7ff4a9da09', todo_category_id),
            ('b4a409f7-4009-4633-b147-f4f99c73f30b', 'Doing', 'c94c7306-73ab-4e17-bad4-0e7ff4a9da09', doing_category_id),
            ('171e791d-6601-45e7-8c5e-80591a610ed8', 'Done', 'c94c7306-73ab-4e17-bad4-0e7ff4a9da09', done_category_id),
            ('757e7655-22c1-4a40-8f3d-2754fbd564dc', 'To Do', '0a769952-e9b8-4e48-b562-f4ebb0f5914e', todo_category_id),
            ('e22f483a-4c87-417c-8c3d-2673c44b1079', 'Doing', '0a769952-e9b8-4e48-b562-f4ebb0f5914e', doing_category_id),
            ('7fae7fde-26a3-44aa-b694-b6d9228e9d6a', 'Done', '0a769952-e9b8-4e48-b562-f4ebb0f5914e', done_category_id);

    INSERT INTO public.pt_tasks (id, name, description, total_minutes, sort_order, priority_id, template_id, parent_task_id, status_id)
    VALUES  ('a75993d9-3fb3-4d0b-a5d4-cab53b60462c', 'Testing and Verification', NULL, 0, 0, medium_priority_id, '39db59be-1dba-448b-87f4-3b955ea699d2', NULL, 'c3242606-5a24-48aa-8320-cc90a05c2589'),
            ('3fdb6801-bc09-4d71-8273-987cd3d1e0f6', 'Bug Prioritization', NULL, 0, 6, medium_priority_id, '39db59be-1dba-448b-87f4-3b955ea699d2', NULL, '05ed8d04-92b1-4c44-bd06-abee29641f31'),
            ('ca64f247-a186-4edb-affd-738f1c2a4d60', 'Bug reporting', NULL, 0, 2, medium_priority_id, '39db59be-1dba-448b-87f4-3b955ea699d2', NULL, 'c3242606-5a24-48aa-8320-cc90a05c2589'),
            ('1e493de8-38cf-4e6e-8f0b-5e1f6f3b07f4', 'Bug Assignment', NULL, 0, 5, medium_priority_id, '39db59be-1dba-448b-87f4-3b955ea699d2', NULL, '05ed8d04-92b1-4c44-bd06-abee29641f31'),
            ('67b2ab3c-53e5-428c-bbad-8bdc19dc88de', 'Bug Closure', NULL, 0, 4, medium_priority_id, '39db59be-1dba-448b-87f4-3b955ea699d2', NULL, '66e80bc8-6b29-4e72-a484-1593eb1fb44b'),
            ('9311ff84-1052-4989-8192-0fea20204fbe', 'Documentation', NULL, 0, 3, medium_priority_id, '39db59be-1dba-448b-87f4-3b955ea699d2', NULL, '66e80bc8-6b29-4e72-a484-1593eb1fb44b'),
            ('7d0697cd-868c-4b41-9f4f-f9a8c1131b24', 'Reporting', NULL, 0, 1, medium_priority_id, '39db59be-1dba-448b-87f4-3b955ea699d2', NULL, '66e80bc8-6b29-4e72-a484-1593eb1fb44b'),
            ('f994718d-3f1c-4880-99da-0b38ce90e0b4', 'Insulation and HVAC', NULL, 0, 4, medium_priority_id, 'd90f9194-200a-4afa-a896-ee5afda2cc8a', NULL, 'a83565f9-2c22-486a-8c10-59182bfe19c6'),
            ('5c5fac9e-5016-4e36-b812-1a9c164adca6', 'Site Preparation', NULL, 0, 8, medium_priority_id, 'd90f9194-200a-4afa-a896-ee5afda2cc8a', NULL, 'a83565f9-2c22-486a-8c10-59182bfe19c6'),
            ('9127f591-e532-4f88-b61e-2a02fd6a654a', 'Electrical and Plumbing', NULL, 0, 5, medium_priority_id, 'd90f9194-200a-4afa-a896-ee5afda2cc8a', NULL, 'a83565f9-2c22-486a-8c10-59182bfe19c6'),
            ('41a6a358-e603-4bf9-9db5-6595f8f00e00', 'Project Planning', NULL, 0, 0, medium_priority_id, 'd90f9194-200a-4afa-a896-ee5afda2cc8a', NULL, 'd8a7ac27-cdfb-48fe-b8cd-c87128269a93'),
            ('c37db3ea-0be7-453b-8588-3672fff523fe', 'Exterior Work', NULL, 0, 6, medium_priority_id, 'd90f9194-200a-4afa-a896-ee5afda2cc8a', NULL, '78803d54-ee61-4389-a5c2-c676f1007d75'),
            ('6ecc497e-ce9a-4a5d-a2a6-a951f26223cf', 'Structural Framing', NULL, 0, 1, medium_priority_id, 'd90f9194-200a-4afa-a896-ee5afda2cc8a', NULL, 'd8a7ac27-cdfb-48fe-b8cd-c87128269a93'),
            ('d53a405b-0bcf-4372-a7ea-d4bca9c13740', 'Foundation Work', NULL, 0, 9, medium_priority_id, 'd90f9194-200a-4afa-a896-ee5afda2cc8a', NULL, '78803d54-ee61-4389-a5c2-c676f1007d75'),
            ('b73154b9-d335-4a3e-8593-84da85801720', 'Finishing and Finishing Work', NULL, 0, 7, medium_priority_id, 'd90f9194-200a-4afa-a896-ee5afda2cc8a', NULL, '78803d54-ee61-4389-a5c2-c676f1007d75'),
            ('5caac736-3ccf-4b0d-ada4-e1cf4f6ef631', 'Quality Assurance and Inspections', NULL, 0, 2, medium_priority_id, 'd90f9194-200a-4afa-a896-ee5afda2cc8a', NULL, 'd8a7ac27-cdfb-48fe-b8cd-c87128269a93'),
            ('44346d7f-fbbd-468a-8c37-e439c268c3e1', 'Utilities and Systems Integration', NULL, 0, 3, medium_priority_id, 'd90f9194-200a-4afa-a896-ee5afda2cc8a', NULL, 'd8a7ac27-cdfb-48fe-b8cd-c87128269a93'),
            ('870daf76-fedb-4198-b13a-9ac453a73dee', 'Brainstorm creative ideas and concepts, and sketch initial designs.', NULL, 0, 0, medium_priority_id, 'c73b8eaf-9a07-4d89-a7e7-84cd2fd4e9f0', NULL, '70cbcea9-2b3c-453a-af0d-fb8a7f6270fd'),
            ('0ebb388d-c7e5-49ce-bf25-e2ce7b9511a1', 'Create storyboards or wireframes to outline the structure and flow of the design.', NULL, 0, 1, medium_priority_id, 'c73b8eaf-9a07-4d89-a7e7-84cd2fd4e9f0', NULL, '70cbcea9-2b3c-453a-af0d-fb8a7f6270fd'),
            ('5d09ae52-7e88-41d6-af82-4efdc55b4af0', 'Create user-friendly interfaces for digital products, ensuring a seamless user experience.', NULL, 0, 2, medium_priority_id, 'c73b8eaf-9a07-4d89-a7e7-84cd2fd4e9f0', NULL, '70cbcea9-2b3c-453a-af0d-fb8a7f6270fd'),
            ('675a8efc-17f2-4c9b-bd06-227020ffa688', 'Develop high-quality visual design assets based on approved concepts.', NULL, 0, 3, medium_priority_id, 'c73b8eaf-9a07-4d89-a7e7-84cd2fd4e9f0', NULL, '70cbcea9-2b3c-453a-af0d-fb8a7f6270fd'),
            ('5403584c-57c4-40f6-8ac5-7c0b89d10370', 'Prepare design files for final production, including optimizing for different platforms.', NULL, 0, 4, medium_priority_id, 'c73b8eaf-9a07-4d89-a7e7-84cd2fd4e9f0', NULL, '70cbcea9-2b3c-453a-af0d-fb8a7f6270fd'),
            ('14de7fa7-e8ac-4d1d-8249-250c733f57c0', 'Collaborate with production teams to produce and deliver the final design assets.', NULL, 0, 5, medium_priority_id, 'c73b8eaf-9a07-4d89-a7e7-84cd2fd4e9f0', NULL, '70cbcea9-2b3c-453a-af0d-fb8a7f6270fd'),
            ('188fcdab-ea71-4be3-96f1-cbe224b53310', 'Research and analyze the target market, including demographics and trends.', NULL, 0, 6, medium_priority_id, 'c73b8eaf-9a07-4d89-a7e7-84cd2fd4e9f0', NULL, '70cbcea9-2b3c-453a-af0d-fb8a7f6270fd'),
            ('a67b4800-b35d-4448-90ba-e6aa1053ea3f', 'Study competitors'' design strategies and identify opportunities for differentiation.', NULL, 0, 7, medium_priority_id, 'c73b8eaf-9a07-4d89-a7e7-84cd2fd4e9f0', NULL, '70cbcea9-2b3c-453a-af0d-fb8a7f6270fd'),
            ('1b5be3a3-ae6d-43f7-8a5a-fa48c96fd54a', 'Class Scheduling', NULL, 0, 8, medium_priority_id, 'c86ed436-f9af-4332-8a2d-2afe9a6d66d4', NULL, 'e6dffb96-6879-4064-ab8f-73ca784b1964'),
            ('fbe32f14-a8e9-401b-8a39-ad53ebd520fa', 'Curriculum Development', NULL, 0, 5, medium_priority_id, 'c86ed436-f9af-4332-8a2d-2afe9a6d66d4', NULL, 'ca81d57d-b7d2-45fc-adcd-1c926fd93e6c'),
            ('1a9bedd1-dbfb-4d25-9b16-ec1eeb773bac', 'Assignments and Homework', NULL, 0, 7, medium_priority_id, 'c86ed436-f9af-4332-8a2d-2afe9a6d66d4', NULL, 'ca81d57d-b7d2-45fc-adcd-1c926fd93e6c'),
            ('3e7db894-b421-46dc-954e-5c38d6270483', 'Grading and Assessment', NULL, 0, 6, medium_priority_id, 'c86ed436-f9af-4332-8a2d-2afe9a6d66d4', NULL, 'e6dffb96-6879-4064-ab8f-73ca784b1964'),
            ('744e8dff-76b0-4450-8ad3-1d38d137c4df', 'Student Progress Tracking', NULL, 0, 4, medium_priority_id, 'c86ed436-f9af-4332-8a2d-2afe9a6d66d4', NULL, 'ca81d57d-b7d2-45fc-adcd-1c926fd93e6c'),
            ('f9b8c333-b8d2-45b8-aff1-d2686aecc23d', 'Resource Management', NULL, 0, 0, medium_priority_id, 'c86ed436-f9af-4332-8a2d-2afe9a6d66d4', NULL, 'efdb40e7-78ae-4a5a-83ec-d372a5816ae5'),
            ('97619dc4-8879-45cc-b17b-bc34db6a658f', 'Research Projects', NULL, 0, 1, medium_priority_id, 'c86ed436-f9af-4332-8a2d-2afe9a6d66d4', NULL, 'efdb40e7-78ae-4a5a-83ec-d372a5816ae5'),
            ('2e277e0f-b389-41de-8caf-c577245be524', 'Event Planning', NULL, 0, 2, medium_priority_id, 'c86ed436-f9af-4332-8a2d-2afe9a6d66d4', NULL, 'efdb40e7-78ae-4a5a-83ec-d372a5816ae5'),
            ('c3bb796c-cfe2-47a8-935e-a9176652279d', 'Budget Management', NULL, 0, 3, medium_priority_id, 'c86ed436-f9af-4332-8a2d-2afe9a6d66d4', NULL, 'efdb40e7-78ae-4a5a-83ec-d372a5816ae5'),
            ('c981c84d-bbe7-48a1-891b-8485b44ba6dc', 'Online Learning Management', NULL, 0, 9, medium_priority_id, 'c86ed436-f9af-4332-8a2d-2afe9a6d66d4', NULL, 'e6dffb96-6879-4064-ab8f-73ca784b1964'),
            ('adbe95e7-a5df-4741-bf1d-79be33654d43', 'Budget Planning', NULL, 0, 0, medium_priority_id, 'a014fae0-1b70-4c05-96b4-1fa8c54591b0', NULL, '0010ae09-0dd6-4c08-b351-30124e0dc436'),
            ('140792fb-d588-4928-8d8a-40641d8982f0', 'Financial Reporting', NULL, 0, 3, medium_priority_id, 'a014fae0-1b70-4c05-96b4-1fa8c54591b0', NULL, '0010ae09-0dd6-4c08-b351-30124e0dc436'),
            ('ae43bf0c-32b9-42e7-8c2d-e13921734669', 'Vendor and Supplier Management', NULL, 0, 4, medium_priority_id, 'a014fae0-1b70-4c05-96b4-1fa8c54591b0', NULL, '0010ae09-0dd6-4c08-b351-30124e0dc436'),
            ('c76b2ba9-a2f3-4acc-8b23-cbf89f9e858e', 'Invoice Management', NULL, 0, 5, medium_priority_id, 'a014fae0-1b70-4c05-96b4-1fa8c54591b0', NULL, '0010ae09-0dd6-4c08-b351-30124e0dc436'),
            ('0079334e-6bbd-45df-8591-444d53df8195', 'Expense Approval Workflow', NULL, 0, 6, medium_priority_id, 'a014fae0-1b70-4c05-96b4-1fa8c54591b0', NULL, '0010ae09-0dd6-4c08-b351-30124e0dc436'),
            ('a656409f-48a2-473c-b53f-9431701e9641', 'Tax Planning and Compliance', NULL, 0, 7, medium_priority_id, 'a014fae0-1b70-4c05-96b4-1fa8c54591b0', NULL, '0010ae09-0dd6-4c08-b351-30124e0dc436'),
            ('5312ae9f-378d-4aff-ac79-55b401750f82', 'Budget Monitoring', NULL, 0, 1, medium_priority_id, 'a014fae0-1b70-4c05-96b4-1fa8c54591b0', NULL, '0010ae09-0dd6-4c08-b351-30124e0dc436'),
            ('d884b9e0-189a-4a2f-9467-92c132295e40', 'Expense Tracking', NULL, 0, 2, medium_priority_id, 'a014fae0-1b70-4c05-96b4-1fa8c54591b0', NULL, '0010ae09-0dd6-4c08-b351-30124e0dc436'),
            ('6e33e82f-ac08-4162-9b84-0f98f8153ec4', 'Identify and reach out to potential candidates through various channels', NULL, 0, 2, medium_priority_id, 'f25549d0-d5de-46aa-bbd5-eaab7a970799', NULL, '35430ef9-040f-465f-b5e3-1f33b26124dd'),
            ('8f02befa-3671-4a18-bd01-817e2fb8f9c7', 'Define the job position, responsibilities, and requirements.', NULL, 0, 4, medium_priority_id, 'f25549d0-d5de-46aa-bbd5-eaab7a970799', NULL, '35430ef9-040f-465f-b5e3-1f33b26124dd'),
            ('f96e15cf-4a99-4f62-a19d-649d890dc364', 'Schedule and conduct interviews with shortlisted candidates.', NULL, 0, 0, medium_priority_id, 'f25549d0-d5de-46aa-bbd5-eaab7a970799', NULL, 'bac101f9-cec3-43aa-8bd8-354de42fdff2'),
            ('e1a78723-a98d-4fa9-ba11-3d5b1429796c', 'Contact provided references to validate candidates'' background and skills.', NULL, 0, 1, medium_priority_id, 'f25549d0-d5de-46aa-bbd5-eaab7a970799', NULL, 'bac101f9-cec3-43aa-8bd8-354de42fdff2'),
            ('e7ca181d-d348-4745-a7d9-8e8f1abcda77', 'Collect feedback from interviewers and team members', NULL, 0, 5, medium_priority_id, 'f25549d0-d5de-46aa-bbd5-eaab7a970799', NULL, '400b58bd-ad09-4cd1-b5bd-a9f7cb46cb47'),
            ('55a7db50-f37d-46b5-be2b-b9938b892ad7', 'Document feedback for future reference and improvement.', NULL, 0, 3, medium_priority_id, 'f25549d0-d5de-46aa-bbd5-eaab7a970799', NULL, '400b58bd-ad09-4cd1-b5bd-a9f7cb46cb47'),
            ('52199ccf-bbea-465d-9e0a-192abd5b4ddf', 'Designing, coding, testing, and maintaining software applications and systems.', NULL, 0, 0, medium_priority_id, '22805d87-ba25-4b2a-8384-7a4eeedc3b63', NULL, '8e9cc873-d9a5-404f-9f38-8ca4fba91a0d'),
            ('87005eaf-d51c-4876-92ea-5071973de1f6', 'Managing servers and computer systems, including installation, configuration, updates, and maintenance.', NULL, 0, 3, medium_priority_id, '22805d87-ba25-4b2a-8384-7a4eeedc3b63', NULL, '856cd7b1-76b1-4182-b2c8-60c278839913'),
            ('64f5c488-7600-4d94-a85b-6fff17ffc746', 'Conducting security audits, vulnerability assessments, and risk management.', NULL, 0, 2, medium_priority_id, '22805d87-ba25-4b2a-8384-7a4eeedc3b63', NULL, 'cbf86a20-8b6d-43d0-99d7-523fb600cdac'),
            ('ad7c0cf8-af9c-46e0-b717-492b29ce4411', 'Managing data integrity, security, and backups.', NULL, 0, 1, medium_priority_id, '22805d87-ba25-4b2a-8384-7a4eeedc3b63', NULL, '8e9cc873-d9a5-404f-9f38-8ca4fba91a0d'),
            ('71f423c7-0de0-445b-b84f-a507c2a56398', 'Performance Optimization', NULL, 0, 4, medium_priority_id, '22805d87-ba25-4b2a-8384-7a4eeedc3b63', NULL, '8e9cc873-d9a5-404f-9f38-8ca4fba91a0d'),
            ('e6a32779-9a8c-4e6c-bf25-0cc33de94f19', 'Privacy and Data Protection', NULL, 0, 6, medium_priority_id, '0aa3f6fc-678f-4d17-8df2-9674ca81fad2', NULL, '54452070-d355-4fb2-b416-e57390d1b668'),
            ('43bec431-1290-420e-8dc6-906204a6d25f', 'Regulatory Filings', NULL, 0, 7, medium_priority_id, '0aa3f6fc-678f-4d17-8df2-9674ca81fad2', NULL, '8aac89fc-cf0c-4a4e-889b-97ccd8e7af94'),
            ('59c54e42-163b-45ab-a3dc-ce0816f5ed9f', 'Litigation and Dispute Resolution', NULL, 0, 5, medium_priority_id, '0aa3f6fc-678f-4d17-8df2-9674ca81fad2', NULL, '8aac89fc-cf0c-4a4e-889b-97ccd8e7af94'),
            ('d82d92a3-54a5-41ac-b77b-c72535bffeb6', 'Contract Management', NULL, 0, 0, medium_priority_id, '0aa3f6fc-678f-4d17-8df2-9674ca81fad2', NULL, '6f0f7261-7f1a-40f3-a771-04fbc5cd0059'),
            ('20697a2d-6586-4ffb-901c-529f154c8b43', 'Contract Renewals and Expirations', NULL, 0, 1, medium_priority_id, '0aa3f6fc-678f-4d17-8df2-9674ca81fad2', NULL, '6f0f7261-7f1a-40f3-a771-04fbc5cd0059'),
            ('1f8826ea-60a9-4d93-a7f8-96fbe72aef6c', 'Compliance Checks', NULL, 0, 4, medium_priority_id, '0aa3f6fc-678f-4d17-8df2-9674ca81fad2', NULL, '54452070-d355-4fb2-b416-e57390d1b668'),
            ('ae28eba7-c9d8-480c-ab42-20e348f0355d', 'Legal Research', NULL, 0, 2, medium_priority_id, '0aa3f6fc-678f-4d17-8df2-9674ca81fad2', NULL, '6f0f7261-7f1a-40f3-a771-04fbc5cd0059'),
            ('049681c1-5a04-4cf3-aaff-fdea575daeb6', 'Intellectual Property Management', NULL, 0, 3, medium_priority_id, '0aa3f6fc-678f-4d17-8df2-9674ca81fad2', NULL, '54452070-d355-4fb2-b416-e57390d1b668'),
            ('bc5d795c-4d2b-4fe2-938a-5f7758e8c90f', 'Develop detailed product design specifications, including materials, dimensions, and functionality.', NULL, 0, 0, medium_priority_id, 'd1baf96f-07f4-4468-bb4f-44cdedfad965', NULL, '0c3c5259-70d2-407b-8a45-c9b81ac84a3a'),
            ('2771231b-9b2d-46c0-ac2d-d34d71f16c09', 'Collaborate with the design and engineering teams to brainstorm innovative ideas for product features and improvements.', NULL, 0, 1, medium_priority_id, 'd1baf96f-07f4-4468-bb4f-44cdedfad965', NULL, '0c3c5259-70d2-407b-8a45-c9b81ac84a3a'),
            ('bab7972e-5668-4fdd-9de2-11b6a6788703', 'Conduct market research to assess the viability of proposed product enhancements and innovations.', NULL, 0, 6, medium_priority_id, 'd1baf96f-07f4-4468-bb4f-44cdedfad965', NULL, '0c3c5259-70d2-407b-8a45-c9b81ac84a3a'),
            ('75720af5-67cc-493d-88cf-4e373bc579e0', 'Develop detailed manufacturing processes, including workflow, quality control measures, and production schedules.', NULL, 0, 3, medium_priority_id, 'd1baf96f-07f4-4468-bb4f-44cdedfad965', NULL, '0c3c5259-70d2-407b-8a45-c9b81ac84a3a'),
            ('3a57acd0-4c0a-4cc8-bf99-0c9f959eaed6', 'Plan and optimize the supply chain, including sourcing raw materials, logistics, and inventory management.', NULL, 0, 2, medium_priority_id, 'd1baf96f-07f4-4468-bb4f-44cdedfad965', NULL, '0c3c5259-70d2-407b-8a45-c9b81ac84a3a'),
            ('fc721d7c-6a69-4241-8294-45122584b238', 'Create prototypes of the product to validate the design and manufacturing processes', NULL, 0, 4, medium_priority_id, 'd1baf96f-07f4-4468-bb4f-44cdedfad965', NULL, '0c3c5259-70d2-407b-8a45-c9b81ac84a3a'),
            ('0264e8c3-d63f-40ba-906c-e3c090ce02ab', 'Create designs for the molds, tooling, and equipment needed in the manufacturing process.', NULL, 0, 7, medium_priority_id, 'd1baf96f-07f4-4468-bb4f-44cdedfad965', NULL, '0c3c5259-70d2-407b-8a45-c9b81ac84a3a'),
            ('b17877ae-0ab0-4ffc-a4fb-49a8c80c0374', 'Perform rigorous testing and validation on prototypes to ensure they meet quality and performance standards.', NULL, 0, 5, medium_priority_id, 'd1baf96f-07f4-4468-bb4f-44cdedfad965', NULL, '0c3c5259-70d2-407b-8a45-c9b81ac84a3a'),
            ('c2d154ca-4e56-4d88-9982-8e5587463b29', 'Delivering value to your customers and leads', NULL, 0, 6, medium_priority_id, 'c6917d57-f84a-40fc-aff0-70fd0aab951f', NULL, '1073754d-c498-4e6d-bcee-68bba526e572'),
            ('5ccadffe-a860-49b2-be7c-73af5a6f81e9', 'Introducing new products or services', NULL, 0, 3, medium_priority_id, 'c6917d57-f84a-40fc-aff0-70fd0aab951f', NULL, '44d54c08-bce6-44e6-9cfc-23d1b4a9e011'),
            ('6e563048-0891-418e-a5f5-28f228f0339b', 'Collecting feedback from customers', NULL, 0, 1, medium_priority_id, 'c6917d57-f84a-40fc-aff0-70fd0aab951f', NULL, '1ae23b11-5edf-485d-9217-f905dc33ddda'),
            ('e83926a9-b618-4398-a4ec-9022314df3bd', 'Building marketing strategies and campaigns', NULL, 0, 2, medium_priority_id, 'c6917d57-f84a-40fc-aff0-70fd0aab951f', NULL, '1ae23b11-5edf-485d-9217-f905dc33ddda'),
            ('08496b12-c259-49ad-9ceb-6669171c38c3', 'Tracking and monitoring marketing campaigns', NULL, 0, 4, medium_priority_id, 'c6917d57-f84a-40fc-aff0-70fd0aab951f', NULL, '1ae23b11-5edf-485d-9217-f905dc33ddda'),
            ('eae2707f-4804-4691-80ba-4f86f71e7b32', 'Creating a strong and dependable brand', NULL, 0, 5, medium_priority_id, 'c6917d57-f84a-40fc-aff0-70fd0aab951f', NULL, '44d54c08-bce6-44e6-9cfc-23d1b4a9e011'),
            ('709e726f-02d8-4549-b77a-c38d14054cf3', 'Boosting company sales', NULL, 0, 7, medium_priority_id, 'c6917d57-f84a-40fc-aff0-70fd0aab951f', NULL, '1073754d-c498-4e6d-bcee-68bba526e572'),
            ('4f2eacd8-daaf-45f6-9986-de5a9c8e459d', 'Resource Management', NULL, 0, 5, medium_priority_id, '5d1ffd21-a7b7-4a5a-9d19-f7fd3ee253e7', NULL, 'd2bff598-5135-4cac-92aa-641b69ae1dab'),
            ('483d6ba0-ce02-4f0f-8f27-d417289939a5', 'Budgeting and Fundraising', NULL, 0, 2, medium_priority_id, '5d1ffd21-a7b7-4a5a-9d19-f7fd3ee253e7', NULL, 'd2bff598-5135-4cac-92aa-641b69ae1dab'),
            ('e70c332b-d0f6-403b-b3c0-cc7467487cae', 'Project Planning', NULL, 0, 3, medium_priority_id, '5d1ffd21-a7b7-4a5a-9d19-f7fd3ee253e7', NULL, 'da60606a-ced5-46bf-bf2f-4ee9d5627a9a'),
            ('6686a09b-f767-466a-a355-fe8d9a16c28b', 'Task Management', NULL, 0, 4, medium_priority_id, '5d1ffd21-a7b7-4a5a-9d19-f7fd3ee253e7', NULL, '9ec60343-27fe-4af5-a35b-d356ebd61837'),
            ('f819d4fc-d3d9-48a8-b06e-92e982686d25', 'Project Initiation', NULL, 0, 0, medium_priority_id, '5d1ffd21-a7b7-4a5a-9d19-f7fd3ee253e7', NULL, 'da60606a-ced5-46bf-bf2f-4ee9d5627a9a'),
            ('a224c0dc-d86d-4fdb-9f69-bd59d26f9760', 'Communication and Collaboration', NULL, 0, 1, medium_priority_id, '5d1ffd21-a7b7-4a5a-9d19-f7fd3ee253e7', NULL, '9ec60343-27fe-4af5-a35b-d356ebd61837'),
            ('b8766b9d-5ea3-4704-ad6e-88d5f94eb816', 'Home Renovation Project', NULL, 0, 0, medium_priority_id, 'e71b3b9b-31a8-47ae-84d8-6dc2ae62e06a', NULL, '2e14a9e9-4c1a-4596-a0f2-574d2e7b2fa4'),
            ('f4a7de5a-7ffd-4ae3-8266-7fe12a75256f', 'Education and Self-Improvement', NULL, 0, 7, medium_priority_id, 'e71b3b9b-31a8-47ae-84d8-6dc2ae62e06a', NULL, '2e14a9e9-4c1a-4596-a0f2-574d2e7b2fa4'),
            ('651c7ffe-58d4-4807-aef5-720e58d254d8', 'Event Planning', NULL, 0, 1, medium_priority_id, 'e71b3b9b-31a8-47ae-84d8-6dc2ae62e06a', NULL, '2e14a9e9-4c1a-4596-a0f2-574d2e7b2fa4'),
            ('d3c78cb9-72b8-4277-ae12-094ce4be1bbc', 'Fitness and Health Goals', NULL, 0, 2, medium_priority_id, 'e71b3b9b-31a8-47ae-84d8-6dc2ae62e06a', NULL, '1a403c75-5d8c-4752-bf96-e486b8042df6'),
            ('619f02b0-7639-42aa-ae39-2808289c713f', 'Vacation Planning', NULL, 0, 3, medium_priority_id, 'e71b3b9b-31a8-47ae-84d8-6dc2ae62e06a', NULL, '1a403c75-5d8c-4752-bf96-e486b8042df6'),
            ('edc39164-215e-4a4c-9e91-a4ef1cc17709', 'Home Organization', NULL, 0, 4, medium_priority_id, 'e71b3b9b-31a8-47ae-84d8-6dc2ae62e06a', NULL, '70fd7f98-b278-440a-8a33-d3453bfd4b70'),
            ('d7a2898a-887c-4832-af44-4c2bfa8c482f', 'Personal Blog', NULL, 0, 5, medium_priority_id, 'e71b3b9b-31a8-47ae-84d8-6dc2ae62e06a', NULL, '70fd7f98-b278-440a-8a33-d3453bfd4b70'),
            ('1510b125-197d-4389-afa9-70d2ee2c610e', 'Financial Goals', NULL, 0, 6, medium_priority_id, 'e71b3b9b-31a8-47ae-84d8-6dc2ae62e06a', NULL, '70fd7f98-b278-440a-8a33-d3453bfd4b70'),
            ('a2c8a7ca-8f5f-4fe0-ac47-a186dc8cea25', 'Integration with Existing Systems', NULL, 0, 5, medium_priority_id, 'bdf32f36-e85b-434f-aeda-dde2e8ade8c7', NULL, 'b450e432-63f4-46a9-bd4a-26b0bdd37507'),
            ('fff9365e-e86f-46d4-8ac3-e90ac6c8f391', 'Initial Contact and Relationship Building', NULL, 0, 4, medium_priority_id, 'bdf32f36-e85b-434f-aeda-dde2e8ade8c7', NULL, '291095da-b3d9-40aa-bcd2-5cd6fb51b89f'),
            ('8d3df58a-3b57-4269-9f23-a02d8630b001', 'Lead Qualification and Research', NULL, 0, 0, medium_priority_id, 'bdf32f36-e85b-434f-aeda-dde2e8ade8c7', NULL, 'c20816ac-fe57-4471-91b0-61fa060663ca'),
            ('c1a6dc5c-e952-43e0-bd02-5505e4db72f0', 'Initial Outreach and Engagement', NULL, 0, 1, medium_priority_id, 'bdf32f36-e85b-434f-aeda-dde2e8ade8c7', NULL, 'c20816ac-fe57-4471-91b0-61fa060663ca'),
            ('7b1ec3b2-5e72-4b4d-87f6-1b158e4b98a4', 'Lost Opportunity Analysis', NULL, 0, 2, medium_priority_id, 'bdf32f36-e85b-434f-aeda-dde2e8ade8c7', NULL, 'c20816ac-fe57-4471-91b0-61fa060663ca'),
            ('2fd89257-98c7-4bae-9186-961259edd4fd', 'Competitor Analysis and Benchmarking', NULL, 0, 3, medium_priority_id, 'bdf32f36-e85b-434f-aeda-dde2e8ade8c7', NULL, '291095da-b3d9-40aa-bcd2-5cd6fb51b89f'),
            ('d43541ae-bc9c-49ad-aa5f-097563ca3e2d', 'Post-Sale Follow-Up and Relationship Building', NULL, 0, 6, medium_priority_id, 'bdf32f36-e85b-434f-aeda-dde2e8ade8c7', NULL, 'b450e432-63f4-46a9-bd4a-26b0bdd37507'),
            ('24ae6a1a-019d-4040-bacc-115be99f7982', 'Testing and Quality Assurance', NULL, 0, 7, medium_priority_id, 'bdf32f36-e85b-434f-aeda-dde2e8ade8c7', NULL, 'b450e432-63f4-46a9-bd4a-26b0bdd37507'),
            ('1c78e9bd-e869-4486-a891-5dae020f35da', 'Client Onboarding', NULL, 0, 0, medium_priority_id, 'c94c7306-73ab-4e17-bad4-0e7ff4a9da09', NULL, '4da7cb15-9767-4522-9950-6a4b26e660a6'),
            ('642b2621-16bb-4615-9b4c-4ea6cd32f7e9', 'Project Documentation', NULL, 0, 1, medium_priority_id, 'c94c7306-73ab-4e17-bad4-0e7ff4a9da09', NULL, '4da7cb15-9767-4522-9950-6a4b26e660a6'),
            ('df901da9-9a6e-4d54-9fbd-e14065dadc40', 'Task Management', NULL, 0, 6, medium_priority_id, 'c94c7306-73ab-4e17-bad4-0e7ff4a9da09', NULL, '171e791d-6601-45e7-8c5e-80591a610ed8'),
            ('643deb27-9521-4672-9ebc-9349e39607a4', 'Resource Allocation', NULL, 0, 8, medium_priority_id, 'c94c7306-73ab-4e17-bad4-0e7ff4a9da09', NULL, '4da7cb15-9767-4522-9950-6a4b26e660a6'),
            ('77278afe-54fa-4174-b56f-bf2217aaa8d6', 'Risk Assessment and Management', NULL, 0, 9, medium_priority_id, 'c94c7306-73ab-4e17-bad4-0e7ff4a9da09', NULL, 'b4a409f7-4009-4633-b147-f4f99c73f30b'),
            ('baa06fdf-495a-42ee-ba1c-026953301487', 'Time and Expense Tracking', NULL, 0, 2, medium_priority_id, 'c94c7306-73ab-4e17-bad4-0e7ff4a9da09', NULL, '4da7cb15-9767-4522-9950-6a4b26e660a6'),
            ('f80ecf2c-4e52-4957-bb3a-3bd5f98b1017', 'Continuous Improvement', NULL, 0, 3, medium_priority_id, 'c94c7306-73ab-4e17-bad4-0e7ff4a9da09', NULL, '4da7cb15-9767-4522-9950-6a4b26e660a6'),
            ('f3565c7f-39cd-46b4-bc44-2682d7b48cbc', 'Client Satisfaction and Feedback', NULL, 0, 5, medium_priority_id, 'c94c7306-73ab-4e17-bad4-0e7ff4a9da09', NULL, 'b4a409f7-4009-4633-b147-f4f99c73f30b'),
            ('2080b4ac-4e00-4e24-9f93-05b54d72f2e9', 'Client Communication', NULL, 0, 4, medium_priority_id, 'c94c7306-73ab-4e17-bad4-0e7ff4a9da09', NULL, 'b4a409f7-4009-4633-b147-f4f99c73f30b'),
            ('276bf24a-da04-4276-bbb8-206e9b276968', 'Project Planning', NULL, 0, 7, medium_priority_id, 'c94c7306-73ab-4e17-bad4-0e7ff4a9da09', NULL, '171e791d-6601-45e7-8c5e-80591a610ed8'),
            ('5fd32a4a-4ab0-44ad-873d-459b9062ae6e', 'User Acceptance Testing', NULL, 0, 12, medium_priority_id, '0a769952-e9b8-4e48-b562-f4ebb0f5914e', NULL, '757e7655-22c1-4a40-8f3d-2754fbd564dc'),
            ('8f54a3a2-38cc-48d6-85e1-d8fe47eea2f0', 'Requirement Gathering', NULL, 0, 11, medium_priority_id, '0a769952-e9b8-4e48-b562-f4ebb0f5914e', NULL, '757e7655-22c1-4a40-8f3d-2754fbd564dc'),
            ('091b0fea-c089-499d-a9e4-8a0eba3bbe47', 'Coding', NULL, 0, 4, medium_priority_id, '0a769952-e9b8-4e48-b562-f4ebb0f5914e', NULL, '757e7655-22c1-4a40-8f3d-2754fbd564dc'),
            ('a4b2ead5-9d73-4064-b261-35cfcd0e6f89', 'Unit Testing', NULL, 0, 6, medium_priority_id, '0a769952-e9b8-4e48-b562-f4ebb0f5914e', NULL, '7fae7fde-26a3-44aa-b694-b6d9228e9d6a'),
            ('81cab85b-0272-40b2-9163-92973bc0fdfd', 'Continuous Integration/Continuous Deployment (CI/CD)', NULL, 0, 7, medium_priority_id, '0a769952-e9b8-4e48-b562-f4ebb0f5914e', NULL, 'e22f483a-4c87-417c-8c3d-2673c44b1079'),
            ('c7b7ac95-5c5a-4dcd-8a59-c8060011f753', 'Code Review', NULL, 0, 10, medium_priority_id, '0a769952-e9b8-4e48-b562-f4ebb0f5914e', NULL, 'e22f483a-4c87-417c-8c3d-2673c44b1079'),
            ('914b10d9-622a-4269-b6bc-07c1377fb512', 'Collaboration and Communication', NULL, 0, 9, medium_priority_id, '0a769952-e9b8-4e48-b562-f4ebb0f5914e', NULL, '7fae7fde-26a3-44aa-b694-b6d9228e9d6a');

    INSERT INTO public.pt_task_phases (task_id, phase_id)
    VALUES  ('a75993d9-3fb3-4d0b-a5d4-cab53b60462c', '4b4a8fe0-4f35-464a-a337-848e5b432ab5'),
            ('3fdb6801-bc09-4d71-8273-987cd3d1e0f6', '557b58ca-3335-4b41-9880-fdd0f990deb9'),
            ('ca64f247-a186-4edb-affd-738f1c2a4d60', '62097027-979f-4b00-afb8-f70fba533f80'),
            ('1e493de8-38cf-4e6e-8f0b-5e1f6f3b07f4', 'e3128891-4873-4795-ad8a-880474280045'),
            ('67b2ab3c-53e5-428c-bbad-8bdc19dc88de', '77204bf3-fcb3-4e39-a843-14458b2f659d'),
            ('9311ff84-1052-4989-8192-0fea20204fbe', '62097027-979f-4b00-afb8-f70fba533f80'),
            ('7d0697cd-868c-4b41-9f4f-f9a8c1131b24', '62097027-979f-4b00-afb8-f70fba533f80'),
            ('f994718d-3f1c-4880-99da-0b38ce90e0b4', '76356365-e420-46b7-b7ff-1747589cb7c9'),
            ('5c5fac9e-5016-4e36-b812-1a9c164adca6', 'a0cb92e9-1e44-4fd6-9522-a1ec5d50fd5c'),
            ('9127f591-e532-4f88-b61e-2a02fd6a654a', '76356365-e420-46b7-b7ff-1747589cb7c9'),
            ('41a6a358-e603-4bf9-9db5-6595f8f00e00', 'a0cb92e9-1e44-4fd6-9522-a1ec5d50fd5c'),
            ('c37db3ea-0be7-453b-8588-3672fff523fe', '6872d742-8e8e-43fe-8d3b-031ff23ba32f'),
            ('6ecc497e-ce9a-4a5d-a2a6-a951f26223cf', '1bea49a2-ba94-4c3a-acd3-973edfc182c8'),
            ('d53a405b-0bcf-4372-a7ea-d4bca9c13740', 'a0cb92e9-1e44-4fd6-9522-a1ec5d50fd5c'),
            ('b73154b9-d335-4a3e-8593-84da85801720', '6872d742-8e8e-43fe-8d3b-031ff23ba32f'),
            ('5caac736-3ccf-4b0d-ada4-e1cf4f6ef631', '702c5891-85bf-4b11-ab70-4f84557b65be'),
            ('44346d7f-fbbd-468a-8c37-e439c268c3e1', '702c5891-85bf-4b11-ab70-4f84557b65be'),
            ('870daf76-fedb-4198-b13a-9ac453a73dee', 'a6db279b-61e9-4e3b-9521-dfae7bb1c0bb'),
            ('0ebb388d-c7e5-49ce-bf25-e2ce7b9511a1', 'a6db279b-61e9-4e3b-9521-dfae7bb1c0bb'),
            ('5d09ae52-7e88-41d6-af82-4efdc55b4af0', 'a6db279b-61e9-4e3b-9521-dfae7bb1c0bb'),
            ('675a8efc-17f2-4c9b-bd06-227020ffa688', '8c3d49a2-6057-42fe-a458-f4596dc31eb4'),
            ('5403584c-57c4-40f6-8ac5-7c0b89d10370', '42df6764-069f-45e6-8b74-4f1e82e8c1e6'),
            ('14de7fa7-e8ac-4d1d-8249-250c733f57c0', '42df6764-069f-45e6-8b74-4f1e82e8c1e6'),
            ('188fcdab-ea71-4be3-96f1-cbe224b53310', 'b871bc4f-aa95-4bec-b943-0a518d29019a'),
            ('a67b4800-b35d-4448-90ba-e6aa1053ea3f', 'b871bc4f-aa95-4bec-b943-0a518d29019a'),
            ('1b5be3a3-ae6d-43f7-8a5a-fa48c96fd54a', '05148a01-26f4-40ef-966d-f7ec601f08e4'),
            ('fbe32f14-a8e9-401b-8a39-ad53ebd520fa', '97248076-3eda-434e-8e9d-4b15a9faefca'),
            ('1a9bedd1-dbfb-4d25-9b16-ec1eeb773bac', '05148a01-26f4-40ef-966d-f7ec601f08e4'),
            ('3e7db894-b421-46dc-954e-5c38d6270483', '97248076-3eda-434e-8e9d-4b15a9faefca'),
            ('744e8dff-76b0-4450-8ad3-1d38d137c4df', '37eb54c4-d10c-428b-a2e8-1842de245b56'),
            ('f9b8c333-b8d2-45b8-aff1-d2686aecc23d', '37eb54c4-d10c-428b-a2e8-1842de245b56'),
            ('97619dc4-8879-45cc-b17b-bc34db6a658f', '8cfe36b7-3d19-45f4-bf2b-ec5ea16efb23'),
            ('2e277e0f-b389-41de-8caf-c577245be524', '8cfe36b7-3d19-45f4-bf2b-ec5ea16efb23'),
            ('c3bb796c-cfe2-47a8-935e-a9176652279d', 'd642aacb-85ee-4f23-a0af-c1e4ea9f3128'),
            ('c981c84d-bbe7-48a1-891b-8485b44ba6dc', 'd642aacb-85ee-4f23-a0af-c1e4ea9f3128'),
            ('adbe95e7-a5df-4741-bf1d-79be33654d43', '0d5e5593-76f6-4fd7-b979-40b0ae306ff3'),
            ('140792fb-d588-4928-8d8a-40641d8982f0', '290fb77c-b727-43ba-a31d-06cd73ead1cc'),
            ('ae43bf0c-32b9-42e7-8c2d-e13921734669', '641997aa-f850-41d9-bbe6-1901cb439c42'),
            ('c76b2ba9-a2f3-4acc-8b23-cbf89f9e858e', '641997aa-f850-41d9-bbe6-1901cb439c42'),
            ('0079334e-6bbd-45df-8591-444d53df8195', '726d1785-3686-4ff9-bd95-f2f409d915ff'),
            ('a656409f-48a2-473c-b53f-9431701e9641', '726d1785-3686-4ff9-bd95-f2f409d915ff'),
            ('5312ae9f-378d-4aff-ac79-55b401750f82', '290fb77c-b727-43ba-a31d-06cd73ead1cc'),
            ('d884b9e0-189a-4a2f-9467-92c132295e40', '290fb77c-b727-43ba-a31d-06cd73ead1cc'),
            ('6e33e82f-ac08-4162-9b84-0f98f8153ec4', '56af064d-df42-49c5-b5e6-438316ee25d7'),
            ('8f02befa-3671-4a18-bd01-817e2fb8f9c7', 'aa1888cc-5bc3-4f71-b409-4b5edf4a1627'),
            ('f96e15cf-4a99-4f62-a19d-649d890dc364', 'b052092d-d5e2-4ac2-979e-6add568a6781'),
            ('e1a78723-a98d-4fa9-ba11-3d5b1429796c', '4b1619ef-d86d-4c18-b163-b959c732830f'),
            ('e7ca181d-d348-4745-a7d9-8e8f1abcda77', 'b052092d-d5e2-4ac2-979e-6add568a6781'),
            ('55a7db50-f37d-46b5-be2b-b9938b892ad7', '23c1c050-af67-45ef-8a1e-7d7da60a23b9'),
            ('52199ccf-bbea-465d-9e0a-192abd5b4ddf', 'f543d067-beff-4c1f-a2b8-203ffe70d4b6'),
            ('87005eaf-d51c-4876-92ea-5071973de1f6', '01062648-d3db-4f52-a0bf-970f663f8349'),
            ('64f5c488-7600-4d94-a85b-6fff17ffc746', '90670cac-e0c4-4928-a8a3-bda0a55dd8e1'),
            ('ad7c0cf8-af9c-46e0-b717-492b29ce4411', '28c1e81c-5169-4f1f-b1ce-f7da05a446a0'),
            ('71f423c7-0de0-445b-b84f-a507c2a56398', '01062648-d3db-4f52-a0bf-970f663f8349'),
            ('e6a32779-9a8c-4e6c-bf25-0cc33de94f19', 'a2a92231-fb9e-4285-aa8a-abd1f20eaad0'),
            ('43bec431-1290-420e-8dc6-906204a6d25f', 'e8275563-8dba-4172-99b9-7c9ab5187e39'),
            ('59c54e42-163b-45ab-a3dc-ce0816f5ed9f', '0a49c05e-c642-4235-8a36-03c6f29b7be4'),
            ('d82d92a3-54a5-41ac-b77b-c72535bffeb6', 'a2a92231-fb9e-4285-aa8a-abd1f20eaad0'),
            ('20697a2d-6586-4ffb-901c-529f154c8b43', 'c51e1c30-a4db-4419-8f65-9fa94496a773'),
            ('1f8826ea-60a9-4d93-a7f8-96fbe72aef6c', '0a49c05e-c642-4235-8a36-03c6f29b7be4'),
            ('ae28eba7-c9d8-480c-ab42-20e348f0355d', 'c51e1c30-a4db-4419-8f65-9fa94496a773'),
            ('049681c1-5a04-4cf3-aaff-fdea575daeb6', '0a49c05e-c642-4235-8a36-03c6f29b7be4'),
            ('bc5d795c-4d2b-4fe2-938a-5f7758e8c90f', '590f0b13-461e-43ca-bc10-136f1eeb340c'),
            ('2771231b-9b2d-46c0-ac2d-d34d71f16c09', '6ad92c84-c953-4077-b652-39474a8e83c6'),
            ('bab7972e-5668-4fdd-9de2-11b6a6788703', '590f0b13-461e-43ca-bc10-136f1eeb340c'),
            ('75720af5-67cc-493d-88cf-4e373bc579e0', '912e172c-3a21-4b16-a0da-bf86a1e01719'),
            ('3a57acd0-4c0a-4cc8-bf99-0c9f959eaed6', '912e172c-3a21-4b16-a0da-bf86a1e01719'),
            ('fc721d7c-6a69-4241-8294-45122584b238', 'a1124508-f464-46e9-85c6-33590d37c913'),
            ('0264e8c3-d63f-40ba-906c-e3c090ce02ab', '590f0b13-461e-43ca-bc10-136f1eeb340c'),
            ('b17877ae-0ab0-4ffc-a4fb-49a8c80c0374', 'a1124508-f464-46e9-85c6-33590d37c913'),
            ('c2d154ca-4e56-4d88-9982-8e5587463b29', 'e36f2219-46be-44ab-8699-0d4c70d5d6d0'),
            ('5ccadffe-a860-49b2-be7c-73af5a6f81e9', '9766b4ca-5599-48cb-9b12-83210b49e152'),
            ('6e563048-0891-418e-a5f5-28f228f0339b', '3bdc66df-dae8-472b-8820-94326307b6ec'),
            ('e83926a9-b618-4398-a4ec-9022314df3bd', '3bdc66df-dae8-472b-8820-94326307b6ec'),
            ('08496b12-c259-49ad-9ceb-6669171c38c3', '9766b4ca-5599-48cb-9b12-83210b49e152'),
            ('eae2707f-4804-4691-80ba-4f86f71e7b32', '01394483-9074-4ae3-86bc-61fb9e1a0886'),
            ('709e726f-02d8-4549-b77a-c38d14054cf3', 'e36f2219-46be-44ab-8699-0d4c70d5d6d0'),
            ('4f2eacd8-daaf-45f6-9986-de5a9c8e459d', 'e4c0558b-f275-464d-a531-e56f6728fd4d'),
            ('483d6ba0-ce02-4f0f-8f27-d417289939a5', '5110d5e4-f4e8-4f4b-86e4-b93b921cc76b'),
            ('e70c332b-d0f6-403b-b3c0-cc7467487cae', '5110d5e4-f4e8-4f4b-86e4-b93b921cc76b'),
            ('6686a09b-f767-466a-a355-fe8d9a16c28b', '82361471-13cb-4d55-a48e-ae72d4269dec'),
            ('f819d4fc-d3d9-48a8-b06e-92e982686d25', 'eca3fd1f-2c80-4983-92eb-a4969e16c5ec'),
            ('a224c0dc-d86d-4fdb-9f69-bd59d26f9760', '5110d5e4-f4e8-4f4b-86e4-b93b921cc76b'),
            ('b8766b9d-5ea3-4704-ad6e-88d5f94eb816', '217d01b8-dc31-4ba9-a6f2-ce32369f7797'),
            ('f4a7de5a-7ffd-4ae3-8266-7fe12a75256f', '217d01b8-dc31-4ba9-a6f2-ce32369f7797'),
            ('651c7ffe-58d4-4807-aef5-720e58d254d8', 'aceff9cb-e679-46b0-b148-a4d15154ddfe'),
            ('d3c78cb9-72b8-4277-ae12-094ce4be1bbc', '114a8e9d-a7a6-4445-854c-469208dd9c10'),
            ('619f02b0-7639-42aa-ae39-2808289c713f', '114a8e9d-a7a6-4445-854c-469208dd9c10'),
            ('edc39164-215e-4a4c-9e91-a4ef1cc17709', 'fa8437aa-2131-4bb8-9361-25d7bab6bde6'),
            ('d7a2898a-887c-4832-af44-4c2bfa8c482f', 'aceff9cb-e679-46b0-b148-a4d15154ddfe'),
            ('1510b125-197d-4389-afa9-70d2ee2c610e', 'fa8437aa-2131-4bb8-9361-25d7bab6bde6'),
            ('a2c8a7ca-8f5f-4fe0-ac47-a186dc8cea25', '7cdafda5-30f1-42c0-8fe2-edcf7522724b'),
            ('fff9365e-e86f-46d4-8ac3-e90ac6c8f391', '7cdafda5-30f1-42c0-8fe2-edcf7522724b'),
            ('8d3df58a-3b57-4269-9f23-a02d8630b001', '6810f956-cb7e-4689-b717-917246f2ae25'),
            ('c1a6dc5c-e952-43e0-bd02-5505e4db72f0', '36b7080d-2875-4dcb-ae8e-eb06468cf2b0'),
            ('7b1ec3b2-5e72-4b4d-87f6-1b158e4b98a4', '36b7080d-2875-4dcb-ae8e-eb06468cf2b0'),
            ('2fd89257-98c7-4bae-9186-961259edd4fd', '36b7080d-2875-4dcb-ae8e-eb06468cf2b0'),
            ('d43541ae-bc9c-49ad-aa5f-097563ca3e2d', '9bf13d98-1393-4e56-87bd-72ff466e6521'),
            ('24ae6a1a-019d-4040-bacc-115be99f7982', '9bf13d98-1393-4e56-87bd-72ff466e6521'),
            ('1c78e9bd-e869-4486-a891-5dae020f35da', '6dc18765-0b64-4e8d-8ba7-b99c64a3bbc3'),
            ('642b2621-16bb-4615-9b4c-4ea6cd32f7e9', '9b0ba3d3-e244-429e-b309-27d24fe5f484'),
            ('df901da9-9a6e-4d54-9fbd-e14065dadc40', '9b0ba3d3-e244-429e-b309-27d24fe5f484'),
            ('643deb27-9521-4672-9ebc-9349e39607a4', '6dc18765-0b64-4e8d-8ba7-b99c64a3bbc3'),
            ('77278afe-54fa-4174-b56f-bf2217aaa8d6', '6dc18765-0b64-4e8d-8ba7-b99c64a3bbc3'),
            ('baa06fdf-495a-42ee-ba1c-026953301487', 'bce4184c-1317-454d-badc-da2549493f01'),
            ('f80ecf2c-4e52-4957-bb3a-3bd5f98b1017', '1966e857-54d2-4e1b-a22e-e120c96724e6'),
            ('f3565c7f-39cd-46b4-bc44-2682d7b48cbc', '1966e857-54d2-4e1b-a22e-e120c96724e6'),
            ('2080b4ac-4e00-4e24-9f93-05b54d72f2e9', 'bce4184c-1317-454d-badc-da2549493f01'),
            ('276bf24a-da04-4276-bbb8-206e9b276968', 'd33b2210-3ef5-4e3b-9f0e-bf2e83e22fff'),
            ('5fd32a4a-4ab0-44ad-873d-459b9062ae6e', '4a7831cc-5b26-470c-8966-4093f3fd9a8a'),
            ('8f54a3a2-38cc-48d6-85e1-d8fe47eea2f0', '4a7831cc-5b26-470c-8966-4093f3fd9a8a'),
            ('091b0fea-c089-499d-a9e4-8a0eba3bbe47', '039d221e-b71a-4f55-b4a0-ac80e7a382da'),
            ('a4b2ead5-9d73-4064-b261-35cfcd0e6f89', '5fe3ea1e-c1c5-4739-8d4f-5595fe47554a'),
            ('81cab85b-0272-40b2-9163-92973bc0fdfd', '039d221e-b71a-4f55-b4a0-ac80e7a382da'),
            ('c7b7ac95-5c5a-4dcd-8a59-c8060011f753', '74bae823-b725-4523-94d2-bfbfba901586'),
            ('914b10d9-622a-4269-b6bc-07c1377fb512', '74bae823-b725-4523-94d2-bfbfba901586');
END;
$$ LANGUAGE plpgsql;


SELECT sys_insert_task_priorities();
SELECT sys_insert_project_access_levels();
SELECT sys_insert_task_status_categories();
SELECT sys_insert_project_statuses();
SELECT sys_insert_project_healths();
SELECT sys_insert_project_templates();

DROP FUNCTION sys_insert_task_priorities();
DROP FUNCTION sys_insert_project_access_levels();
DROP FUNCTION sys_insert_task_status_categories();
DROP FUNCTION sys_insert_project_statuses();
DROP FUNCTION sys_insert_project_healths();
DROP FUNCTION sys_insert_project_templates();

INSERT INTO timezones (name, abbrev, utc_offset)
SELECT name, abbrev, utc_offset
FROM pg_timezone_names;
