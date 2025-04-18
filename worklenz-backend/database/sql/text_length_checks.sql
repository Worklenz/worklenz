ALTER TABLE teams
    ADD CONSTRAINT teams_name_check CHECK (CHAR_LENGTH(name) <= 55);

ALTER TABLE clients
    ADD CONSTRAINT clients_name_check CHECK (CHAR_LENGTH(name) <= 60);

ALTER TABLE job_titles
    ADD CONSTRAINT job_titles_name_check CHECK (CHAR_LENGTH(name) <= 55);

ALTER TABLE users
    ADD CONSTRAINT users_name_check CHECK (CHAR_LENGTH(name) <= 55);

ALTER TABLE users
    ADD CONSTRAINT users_email_check CHECK (CHAR_LENGTH(email) <= 255);

ALTER TABLE projects
    ADD CONSTRAINT projects_name_check CHECK (CHAR_LENGTH(name) <= 100);

ALTER TABLE projects
    ADD CONSTRAINT projects_notes_check CHECK (CHAR_LENGTH(notes) <= 500);

ALTER TABLE task_statuses
    ADD CONSTRAINT task_statuses_name_check CHECK (CHAR_LENGTH(name) <= 50);

ALTER TABLE tasks
    ADD CONSTRAINT tasks_name_check CHECK (CHAR_LENGTH(name) <= 500);

ALTER TABLE tasks
    ADD CONSTRAINT tasks_description_check CHECK (CHAR_LENGTH(description) <= 500000);

ALTER TABLE team_labels
    ADD CONSTRAINT team_labels_name_check CHECK (CHAR_LENGTH(name) <= 40);

ALTER TABLE personal_todo_list
    ADD CONSTRAINT personal_todo_list_name_check CHECK (CHAR_LENGTH(name) <= 100);

ALTER TABLE personal_todo_list
    ADD CONSTRAINT personal_todo_list_description_check CHECK (CHAR_LENGTH(description) <= 200);

ALTER TABLE task_work_log
    ADD CONSTRAINT task_work_log_description_check CHECK (CHAR_LENGTH(description) <= 500);

ALTER TABLE task_comment_contents
    ADD CONSTRAINT task_comment_contents_name_check CHECK (CHAR_LENGTH(text_content) <= 500);

ALTER TABLE task_attachments
    ADD CONSTRAINT task_attachments_name_check CHECK (CHAR_LENGTH(name) <= 110);
