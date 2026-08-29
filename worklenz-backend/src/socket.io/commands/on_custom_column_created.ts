import { Server, Socket } from "socket.io";
import { SocketEvents } from "../events";
import { verifyNonGuestProjectAccessSocket, logUnauthorizedSocketAccess } from "../authorization";

interface CustomColumnCreatedData {
  project_id: string;
}

export const on_custom_column_created = async (_io: Server, socket: Socket, data: string) => {
  try {
    const parsedData: CustomColumnCreatedData = typeof data === "string" ? JSON.parse(data) : data;
    if (!parsedData?.project_id) return;

    if (!(await verifyNonGuestProjectAccessSocket(socket, parsedData.project_id))) {
      logUnauthorizedSocketAccess(socket, "CUSTOM_COLUMN_CREATED", "project", parsedData.project_id);
      return;
    }

    socket.to(parsedData.project_id).emit(
      SocketEvents.CUSTOM_COLUMN_CREATED.toString(),
      JSON.stringify(parsedData)
    );
  } catch (error) {
    console.error("Failed to broadcast custom column creation", error);
  }
};