/**
 * Map all unique indexes, constrains from a database here
 * to send a meaningful message
 *
 * NOTE:
 * Adding "$" sign to the start of the message will ignore displaying it
 * to the end-user by the client's interceptor
 *
 * Adding "[IGNORE]" as the message sends a success empty response to the client
 * */
export const DB_CONSTRAINS: { [x: string]: string | null } = {

  // Unique indexes
  project_access_levels_key_uindex: "",
  project_access_levels_name_uindex: "",
  task_priorities_name_uindex: "",
  clients_name_team_id_uindex: "Client name already exists. Please choose a different name.",
  job_titles_name_team_id_uindex: "Job title already exists. Please choose a different name.",
  users_email_uindex: "A Worklenz account already exists for this email address. Please choose a different email.",
  users_google_id_uindex: "",
  users_socket_id_uindex: "",
  team_members_user_id_team_id_uindex: "Team member with this email already exists.",
  project_members_team_member_project_uindex: "[IGNORE]",
  task_statuses_project_id_name_uindex: "Status already exists. Please choose a different name.",
  tasks_name_project_uindex: "Task name already exists. Please choose a different name.",
  tasks_assignee_task_project_uindex: "",
  permissions_name_uindex: "",
  roles_name_team_id_uindex: "",
  roles_default_uindex: "",
  roles_owner_uindex: "",
  personal_todo_list_index_uindex: "",
  team_labels_name_team_uindex: "Labels cannot be duplicated.",
  projects_key_team_id_uindex: "Try to use a different team name.",
  project_folders_team_id_name_uindex: "Folder already exists. Use a different folder name.",
  project_phases_name_project_uindex: "Option name already exists. Use a different name.",
  project_categories_name_team_id_uindex: "Category already exists. Use a different name",
  // Status already exists. Please choose a different name.

  // Keys
  tasks_project_fk: "This project has tasks associated with it. Please delete all tasks before deleting the project.",
  tasks_assignees_pk: null,
  tasks_status_id_fk: "$One or more tasks (archived/non-archived) will be affected. Please select another status to move the tasks",

  // Check constrains
  projects_color_code_check: "",
  sys_task_status_categories_color_code_check: "",
  tasks_total_minutes_check: "",
  tasks_task_order_check: "",
  personal_todo_list_color_code_check: "",
  task_work_log_time_spent_check: "Invalid log details",
  task_comment_contents_content_check: "",

  teams_name_check: "Team name size exceeded",
  clients_name_check: "Client name size exceeded",
  job_titles_name_check: "Job title name size exceeded",
  users_name_check: "User name size exceeded",
  users_email_check: "Email size exceeded",
  projects_name_check: "Project name size exceeded",
  projects_notes_check: "Project note size exceeded",
  task_statuses_name_check: "Task status name size exceeded",
  tasks_name_check: "Task name size exceeded",
  tasks_description_check: "Task description size exceeded",
  team_labels_name_check: "Label name size exceeded",
  personal_todo_list_name_check: "Name size exceeded",
  personal_todo_list_description_check: "Description size exceeded",
  task_work_log_description_check: "Description size exceeded",
  task_comment_contents_name_check: "Comment size exceeded",
  task_attachments_name_check: "File name size exceeded",
};
