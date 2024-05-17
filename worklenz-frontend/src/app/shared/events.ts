export const EventProfileUpdate = "worklenz.events.profile_update";
export const EventTaskCreatedOrUpdate = "worklenz.tasks.update";
export const EventProjectCreatedOrUpdated = "worklenz.tasks.update";
export const EventMenuChanged = "worklenz.menu.update";
export const EventStatusChanged = "worklenz.status.update";
export const EventTaskTimeLogChange = "worklenz.tasks.timelog.update";
export const EventProfilePictureChange = "worklenz.profile.avatar_change";
export const EventTaskCommentCreate = "worklenz.task_comments.create";

export function dispatchProfileUpdate() {
  document.dispatchEvent(new Event(EventProfileUpdate));
}

export function dispatchTasksChange() {
  document.dispatchEvent(new Event(EventTaskCreatedOrUpdate));
}

export function dispatchTasksTimeLogChange() {
  document.dispatchEvent(new Event(EventTaskTimeLogChange));
}

export function dispatchProjectChange() {
  document.dispatchEvent(new Event(EventProjectCreatedOrUpdated));
}

export function dispatchMenuChange() {
  document.dispatchEvent(new Event(EventMenuChanged));
}

export function dispatchStatusChange() {
  document.dispatchEvent(new Event(EventStatusChanged));
}

export function dispatchProfilePictureChange() {
  document.dispatchEvent(new Event(EventProfilePictureChange));
}

export function dispatchTaskCommentCreate() {
  document.dispatchEvent(new Event(EventTaskCommentCreate));
}
