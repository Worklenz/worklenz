import { Server, Socket } from "socket.io";
import db from "../../config/db";
import { SocketEvents } from "../events";
import { log_error } from "../util";
import momentTime from "moment-timezone";
import moment from "moment-timezone";


async function createAllocation(body: any) {
  const fromStart = Math.floor(body.offset) / 35;
  const duration = Math.floor(body.width) / 35;
  const chartStartDate = moment(body.chart_start);

  body.allocated_from = chartStartDate.add(fromStart, "days").format("YYYY-MM-DD").trim();
  body.allocated_to = moment(body.allocated_from).add(duration - 1, "days").format("YYYY-MM-DD").trim();

  return body;
}

async function checkExists(body: any) {
  const getq = `SELECT id, allocated_from, allocated_to FROM project_member_allocations WHERE project_id = $1 AND team_member_id = $2`;
  const getResult = await db.query(getq, [body.project_id, body.team_member_id]);

  if (getResult.rows.length > 0) {
    for (const row of getResult.rows) {
      const fAllocatedFrom = momentTime.tz(row.allocated_from, `${body.time_zone}`).format("YYYY-MM-DD");
      const fAllocatedTo = momentTime.tz(row.allocated_to, `${body.time_zone}`).format("YYYY-MM-DD");

      if (moment(fAllocatedFrom).isSameOrAfter(moment(body.allocated_from)) && moment(fAllocatedTo).isSameOrBefore(moment(body.allocated_to))) {
        const deleteq = `DELETE FROM project_member_allocations WHERE id IN ($1)`;
        await db.query(deleteq, [row.id]);
      }
    }
  }
}

export async function on_schedule_member_allocation_create(_io: Server, socket: Socket, data?: string) {
  try {
    const body = JSON.parse(data as string);

    await createAllocation(body);
    await checkExists(body);

    const q = `INSERT INTO project_member_allocations(project_id, team_member_id, allocated_from, allocated_to)
                VALUES ($1, $2, $3, $4)`;

    await db.query(q, [body.project_id, body.team_member_id, body.allocated_from, body.allocated_to]);

    socket.emit(SocketEvents.SCHEDULE_MEMBER_ALLOCATION_CREATE.toString(), {
      project_id: body.project_id,
      team_member_id: body.team_member_id
    });

    return;
  } catch (error) {
    log_error(error);
  }

  const body = JSON.parse(data as string);

  socket.emit(SocketEvents.SCHEDULE_MEMBER_ALLOCATION_CREATE.toString(), {
    project_id: body.project_id,
    team_member_id: body.team_member_id
  });

}
