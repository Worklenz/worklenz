import {ITaskAssignmentModelProject, ITaskAssignmentModelTeam} from "../interfaces/task-assignments-model";
import {isLocalServer} from "../shared/utils";

export function mapMembersWithAnd(members: string) {
  const $members = members.split(",").map(m => m.trim());
  if ($members.length > 1) {
    const last = $members.pop();
    const end = last ? ` and ${last}` : "";
    return `${$members.join(", ")}${end}`;
  }
  return "";
}

export function getBaseUrl() {
  if (isLocalServer()) return `http://${process.env.FRONTEND_URL}`;
  return `https://${process.env.FRONTEND_URL}`;
}

export function getClientPortalBaseUrl() {
  if (isLocalServer()) return `http://${process.env.CLIENT_PORTAL_HOSTNAME}`;
  return `https://${process.env.CLIENT_PORTAL_HOSTNAME}`;
}

function mapMembers(project: ITaskAssignmentModelProject) {
  for (const task of project.tasks || []) {
    if (task.members)
      task.members = mapMembersWithAnd(task.members);
  }
}

function updateUrls(project: ITaskAssignmentModelProject) {
  project.url = `${getBaseUrl()}/worklenz/projects/${project.id}`;
  if (project.tasks) {
    project.tasks = project.tasks.map(task => {
      if (task.id)
        task.url = `${project.url}?task=${task.id}`;
      return task;
    });
  }
}

export function mapTeams(data?: ITaskAssignmentModelTeam[]) {
  if (!data) return [];

  const result = [];
  for (const item of data || []) {
    const projects = item.projects?.filter(project => project.tasks?.length);
    for (const project of projects || []) {
      if (project.id) {
        mapMembers(project);
        updateUrls(project);
      }
    }

    if (projects?.length) {
      item.projects = projects;
      result.push(item);
    }
  }
  return result;
}


export function mapProjects(data?: ITaskAssignmentModelTeam[]) {
  if (!data) return [];

  const result = [];
  for (const item of data || []) {
    const projects = item.projects?.filter(project => project.tasks?.length);
    for (const project of projects || []) {
      if (project.id) {
        mapMembers(project);
        updateUrls(project);
        result.push(project);
      }
    }
  }

  return result;
}
