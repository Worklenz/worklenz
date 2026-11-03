import { IO } from "./io";
import { SocketEvents } from "../socket.io/events";
import { reportingRoomName } from "../socket.io/reporting-room";

interface ProjectDates {
  start_date: string | null;
  end_date: string | null;
}

/** Broadcast persisted date changes to project and reporting viewers. */
export const notifyProjectDateChanges = (
  projectId: string,
  ownerId: string | null,
  before: ProjectDates | null,
  after: ProjectDates
): void => {
  const io = IO.getInstance();
  if (!io) return;

  const room = ownerId
    ? io.to(projectId).to(reportingRoomName(ownerId))
    : io.to(projectId);
  for (const field of ["start_date", "end_date"] as const) {
    if (before && before[field] === after[field]) continue;
    const event = field === "start_date"
      ? SocketEvents.PROJECT_START_DATE_CHANGE
      : SocketEvents.PROJECT_END_DATE_CHANGE;
    room.emit(event.toString(), { project_id: projectId, [field]: after[field] });
  }
};
