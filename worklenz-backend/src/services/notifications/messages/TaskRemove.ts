import {INotification} from "../interfaces";

class TaskRemove implements INotification {
  private template = `<user> removed "<task>" from the "<project>".`;
  user_ids!: string[];
  message!: string;

  constructor(userIds: string[], userName: string, taskName: string, projectName: string) {
    this.user_ids = userIds;
    this.message = this.template
      .replace(/<user>/g, userName)
      .replace(/<task>/g, taskName)
      .replace(/<project>/g, projectName);
  }
}
