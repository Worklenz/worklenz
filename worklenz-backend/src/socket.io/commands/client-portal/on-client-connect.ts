import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import db from "../../../config/db";
import { log } from "../../util";

export async function on_client_connect(io: Server, socket: Socket, data: any) {
  try {
    const { token, type } = data;
    
    if (!token || !type) {
      socket.emit('error', { message: 'Token and type are required' });
      return;
    }

    if (type === 'client') {
      // Handle client portal authentication
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret') as any;
      
      if (!decoded.clientId) {
        socket.emit('error', { message: 'Invalid client token' });
        return;
      }

      // Get client information from database
      const clientQuery = `
        SELECT c.*, u.name as user_name 
        FROM client_portal_clients c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.id = $1 AND c.status = 'active'
      `;
      
      const clientResult = await db.query(clientQuery, [decoded.clientId]);
      
      if (clientResult.rows.length === 0) {
        socket.emit('error', { message: 'Client not found or inactive' });
        return;
      }

      const client = clientResult.rows[0];
      
      // Store client info in socket
      (socket as any).user = {
        id: client.id,
        name: client.name || client.user_name,
        type: 'client',
        organizationId: client.organization_team_id,
        email: client.email
      };

      // Update client's socket ID in database
      await db.query(
        'UPDATE client_portal_clients SET socket_id = $1 WHERE id = $2',
        [socket.id, client.id]
      );

      log("CLIENT_PORTAL", `Client ${client.name} (${client.id}) connected via Socket.IO`);
      
      socket.emit('client_portal:connected', {
        success: true,
        clientId: client.id,
        clientName: client.name,
        message: 'Successfully connected to client portal'
      });

    } else if (type === 'team_member') {
      // Handle regular team member authentication (existing logic)
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret') as any;
      
      if (!decoded.userId) {
        socket.emit('error', { message: 'Invalid user token' });
        return;
      }

      // Get user information
      const userQuery = `
        SELECT u.*, t.id as team_id, t.organization_id 
        FROM users u
        LEFT JOIN team_members tm ON u.id = tm.user_id
        LEFT JOIN teams t ON tm.team_id = t.id
        WHERE u.id = $1 AND u.status = 'active'
      `;
      
      const userResult = await db.query(userQuery, [decoded.userId]);
      
      if (userResult.rows.length === 0) {
        socket.emit('error', { message: 'User not found or inactive' });
        return;
      }

      const user = userResult.rows[0];
      
      // Store user info in socket
      (socket as any).user = {
        id: user.id,
        name: user.name,
        type: 'team_member',
        teamId: user.team_id,
        organizationId: user.organization_id,
        email: user.email
      };

      // Update user's socket ID
      await db.query(
        'UPDATE users SET socket_id = $1 WHERE id = $2',
        [socket.id, user.id]
      );

      log("CLIENT_PORTAL", `User ${user.name} (${user.id}) connected via Socket.IO`);
      
      socket.emit('connected', {
        success: true,
        userId: user.id,
        userName: user.name,
        message: 'Successfully connected'
      });
    }

  } catch (error) {
    console.error('Socket authentication error:', error);
    socket.emit('error', { message: 'Authentication failed' });
  }
}