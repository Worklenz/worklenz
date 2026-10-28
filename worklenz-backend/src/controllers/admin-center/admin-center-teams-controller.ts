import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";

import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import { getColor, log_error, sanitizePlainText } from "../../shared/utils";
import {
  checkTeamSubscriptionStatus,
  getActiveTeamMemberCount,
} from "../../shared/paddle-utils";
import { updateUsers } from "../../shared/paddle-requests";
import { statusExclude } from "../../shared/constants";
import { NotificationsService } from "../../services/notifications/notifications.service";
import { SocketEvents } from "../../socket.io/events";
import { IO } from "../../shared/io";
import { actorFromSessionUser, logAuditEvent } from "../../services/audit-log.service";
import { AUDIT_EVENT_TYPE } from "../../shared/audit-log-constants";

export default class AdminCenterTeamsController extends WorklenzControllerBase {
  private static readonly TEAM_DELETE_BLOCKERS = {
    ACTIVE_TEAM: {
      title: "Unable to delete team",
      message:
        "This team cannot be deleted because one or more users still have it selected as their active team. Please switch those users to another team and try again.",
    },
    PROJECT_FOLDERS: {
      title: "Unable to delete team",
      message:
        "This team cannot be deleted because it still has project folders associated with it. Please remove those folders and try again.",
    },
  } as const;

  private static async checkIfUserActiveInOtherTeams(
    owner_id: string,
    email: string
  ) {
    if (!owner_id) throw new Error("Owner not found.");

    const q = `SELECT EXISTS(SELECT tmi.team_member_id
              FROM team_member_info_view AS tmi
                       JOIN teams AS t ON tmi.team_id = t.id
                       JOIN team_members AS tm ON tmi.team_member_id = tm.id
              WHERE tmi.email = $1::TEXT
              AND t.user_id = $2::UUID AND tm.active = true);`;
    const result = await db.query(q, [email, owner_id]);

    const [data] = result.rows;
    return data.exists;
  }

  private static async getTeamDeleteBlocker(teamId: string) {
    const q = `SELECT EXISTS(
                 SELECT 1
                 FROM users
                 WHERE active_team = $1::UUID
               ) AS has_active_users,
               EXISTS(
                 SELECT 1
                 FROM project_folders
                 WHERE team_id = $1::UUID
               ) AS has_project_folders;`;
    const result = await db.query(q, [teamId]);
    const [data] = result.rows;

    if (data?.has_active_users) {
      return this.TEAM_DELETE_BLOCKERS.ACTIVE_TEAM;
    }

    if (data?.has_project_folders) {
      return this.TEAM_DELETE_BLOCKERS.PROJECT_FOLDERS;
    }

    return null;
  }

  @HandleExceptions()
  public static async getOrganizationTeams(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    // owner_id is $1, size is $2, offset is $3, team_id is $4, so search params start at $5
    const { searchQuery, searchParams, size, offset } = this.toPaginationOptions(req.query, [
      "name",
    ], false, 5);

    let size_changed = size;

    if (offset == 0) size_changed = size_changed - 1;

    const currentTeamClosure =
      offset == 0
        ? `,
                          (SELECT COALESCE(ROW_TO_JSON(c), '{}'::JSON)
                            FROM (SELECT id,
                                          name,
                                          created_at,
                                          (SELECT count(*) FROM team_members WHERE team_id = teams.id) as members_count,
                                          (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                          FROM (SELECT CASE
                                                          WHEN u.name IS NOT NULL THEN u.name
                                                          ELSE (SELECT name
                                                                FROM email_invitations
                                                                WHERE team_member_id = team_members.id) END,
                                                        avatar_url
                                                FROM team_members
                                                        LEFT JOIN users u on team_members.user_id = u.id
                                                WHERE team_id = teams.id) rec)                        AS team_members
                                  FROM teams
                                  WHERE user_id = $1 AND teams.id = $4) c) AS current_team_data`
        : ``;

    const q = `SELECT ROW_TO_JSON(rec) AS teams
               FROM (SELECT COUNT(*)                      AS total,
                            (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
                             FROM (SELECT id,
                                          name,
                                          created_at,
                                          (SELECT count(*) FROM team_members WHERE team_id = teams.id) as members_count,
                                          (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                           FROM (SELECT CASE
                                                          WHEN u.name IS NOT NULL THEN u.name
                                                          ELSE (SELECT name
                                                                FROM email_invitations
                                                                WHERE team_member_id = team_members.id) END,
                                                        avatar_url
                                                 FROM team_members
                                                        LEFT JOIN users u on team_members.user_id = u.id
                                                 WHERE team_id = teams.id) rec)                        AS team_members
                                   FROM teams
                                   WHERE user_id = $1 AND NOT teams.id = $4 ${searchQuery}
                                   ORDER BY name, created_at
                                   LIMIT $2 OFFSET $3) t) AS data
                                   ${currentTeamClosure}
                     FROM teams
                     WHERE user_id = $1 ${searchQuery}) rec;`;
    const result = await db.query(q, [
      req.user?.owner_id,
      size_changed,
      offset,
      req.user?.team_id,
      ...searchParams,
    ]);

    const [obj] = result.rows;

    for (const team of obj.teams?.data || []) {
      team.names = this.createTagList(team?.team_members);
      team.names.map((a: any) => (a.color_code = getColor(a.name)));
    }

    if (obj.teams.current_team_data) {
      obj.teams.current_team_data.names = this.createTagList(
        obj.teams.current_team_data?.team_members
      );
      obj.teams.current_team_data.names.map(
        (a: any) => (a.color_code = getColor(a.name))
      );
    }

    return res.status(200).send(new ServerResponse(true, obj.teams || {}));
  }

  @HandleExceptions()
  public static async getTeamDetails(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;

    const q = `SELECT id,
                      name,
                      created_at,
                      (SELECT count(*) FROM team_members WHERE team_id = teams.id) as members_count,
                      (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                       FROM (SELECT tm.id,
                                    tm.user_id,
                                    (SELECT name
                                     FROM team_member_info_view
                                     WHERE team_member_info_view.team_member_id = tm.id),
                                    (SELECT team_member_info_view.email
                                     FROM team_member_info_view
                                     WHERE team_member_info_view.team_member_id = tm.id),
                                    (SELECT team_member_info_view.avatar_url
                                     FROM team_member_info_view
                                     WHERE team_member_info_view.team_member_id = tm.id),
                                    role_id,
                                    r.name AS role_name,
                                    EXISTS(SELECT email
                                           FROM email_invitations
                                           WHERE team_member_id = tm.id
                                             AND email_invitations.team_id = tm.team_id) AS pending_invitation
                             FROM team_members tm
                                    LEFT JOIN users u on tm.user_id = u.id
                                    LEFT JOIN roles r on tm.role_id = r.id
                             WHERE tm.team_id = teams.id
                             ORDER BY r.name = 'Owner' DESC, u.name) rec)          AS team_members
               FROM teams
               WHERE id = $1
                 AND user_id = $2;`;
    const result = await db.query(q, [id, req.user?.owner_id]);

    const [obj] = result.rows;

    if (!obj) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Team not found"));
    }

    obj.names = this.createTagList(obj?.team_members);
    obj.names.map((a: any) => (a.color_code = getColor(a.name)));

    return res.status(200).send(new ServerResponse(true, obj || {}));
  }

  @HandleExceptions()
  public static async updateTeam(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const { name, teamMembers } = req.body;
 
    try {
      // 1. Update team name
      const updateNameQuery = `UPDATE teams SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING id;`;
      const nameResult = await db.query(updateNameQuery, [name, id, req.user?.owner_id]);
 
      if (!nameResult.rows.length) {
        return res
          .status(404)
          .send(new ServerResponse(false, null, "Team not found"));
      }
 
      // 2. Update team member roles and names
      if (teamMembers?.length) {
        await Promise.all(
          teamMembers.map(async (member: {
            id: string;
            role_name: string;
            user_id: string | null;
            name: string;
            pending_invitation?: boolean;
          }) => {
 
            // Always resolve user_id fresh from the DB using the team_member id.
            // Never trust the client-supplied user_id — it may be null or stale
            // because getTeamDetails selects tm.user_id which can be null for
            // pending members whose row exists only in email_invitations.
            const resolveQ = `
              SELECT tm.user_id
              FROM team_members tm
              WHERE tm.id = $1
                AND tm.team_id = $2;
            `;
            const resolveResult = await db.query(resolveQ, [member.id, id]);
 
            if (!resolveResult.rows.length) return; // not in this team — skip
 
            // eslint-disable-next-line prefer-destructuring
            const { user_id } = resolveResult.rows[0];
 
            // 2a. Update role (skip Owner — their role must never change here)
            if (member.role_name && member.role_name !== "Owner") {
              await db.query(
                `UPDATE team_members
                 SET role_id = (
                   SELECT id FROM roles
                   WHERE roles.team_id = $1
                     AND name = $2
                 )
                 WHERE id = $3
                   AND team_id = $1;`,
                [id, member.role_name, member.id]
              );
            }
 
            // 2b. Update name — mirrors COALESCE(u.name, email_invitations.name)
            //     that team_member_info_view uses, so the GET after save returns
            //     the correct updated name immediately.
            if (member.name?.trim()) {
              const trimmedName = member.name.trim();
 
              if (user_id) {
                // Active member — users.name is the COALESCE first branch
                await db.query(
                  `UPDATE users SET name = $1 WHERE id = $2;`,
                  [trimmedName, user_id]
                );
              } else {
                // Pending invitation — email_invitations.name is the fallback branch
                await db.query(
                  `UPDATE email_invitations
                   SET name = $1
                   WHERE team_member_id = $2
                     AND team_id = $3;`,
                  [trimmedName, member.id, id]
                );
              }
            }
          })
        );
      }
 
      return res
        .status(200)
        .send(new ServerResponse(true, null, "Team updated successfully"));
    } catch (error) {
      log_error(error);
      return res
        .status(500)
        .send(new ServerResponse(false, null, "Failed to update team"));
    }
  }

  @HandleExceptions()
  public static async deleteTeam(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const ownerId = req.user?.owner_id;

    if (!ownerId) {
      return res
        .status(200)
        .send(new ServerResponse(false, null, "User not found").withTitle("Unable to delete team"));
    }

    if (id == req.user?.team_id) {
      return res
        .status(200)
        .send(
          new ServerResponse(
            true,
            [],
            "Please switch to another team before attempting deletion."
          ).withTitle("Unable to remove the presently active team!")
        );
    }

    const blocker = await this.getTeamDeleteBlocker(id);
    if (blocker) {
      return res
        .status(200)
        .send(new ServerResponse(false, null, blocker.message).withTitle(blocker.title));
    }

    // captured before the DELETE purely for a readable description.
    const teamNameResult = await db.query(`SELECT name FROM teams WHERE id = $1`, [id]);
    const teamName = teamNameResult.rows[0]?.name;

    const q = `DELETE FROM teams
               WHERE id = $1
                 AND user_id = $2
               RETURNING id;`;
    const result = await db.query(q, [id, ownerId]);

    if (!result.rowCount) {
      return res
        .status(200)
        .send(new ServerResponse(false, null, "Team not found").withTitle("Unable to delete team"));
    }

    // teamId is deliberately omitted/null here: audit_events.team_id
    // writes land asynchronously (logAuditEvent is fire-and-forget via queueMicrotask), by
    // which time the just-deleted team row above no longer exists, so passing its id would
    // fail the FK constraint and the entry would silently be dropped. The organization
    // itself is unaffected by deleting one of its teams (organizations.user_id = team's
    // owner user_id, not teams.id — see the scope note in
    // 1791193625587_create-audit-events-table.js), so organizationId is still valid.
    if (req.user?.organization_id) {
      logAuditEvent({
        organizationId: req.user.organization_id,
        teamId: null,
        actor: actorFromSessionUser(req.user),
        eventType: AUDIT_EVENT_TYPE.TEAM_DELETED.id,
        description: `Deleted team "${teamName || id}"`,
      });
    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async deleteById(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const { teamId } = req.body;

    if (!id || !teamId)
      return res
        .status(200)
        .send(new ServerResponse(false, "Required fields are missing."));

    // Prevent self-removal using the current session identity already resolved on the request.
    const isSelfRemoval = !!req.user?.team_member_id && id === req.user.team_member_id;
    if (isSelfRemoval) {
      return res
        .status(200)
        .send(
          new ServerResponse(
            false,
            null,
            "You cannot remove yourself from the team.",
          ),
        );
    }

    // check subscription status
    const subscriptionData = await checkTeamSubscriptionStatus(teamId);
    if (statusExclude.includes(subscriptionData.subscription_status)) {
      return res
        .status(200)
        .send(
          new ServerResponse(false, "Please check your subscription status.")
        );
    }

    const q = `SELECT remove_team_member($1, $2, $3) AS member;`;
    const result = await db.query(q, [id, req.user?.id, teamId]);
    const [data] = result.rows;

    const safeName = sanitizePlainText(req.user?.name || 'an administrator');
    const safeTeamName = sanitizePlainText(req.user?.team_name || 'the team');
    const message = `You have been removed from <b>${safeTeamName}</b> by <b>${safeName}</b>`;

    // if (subscriptionData.status === "trialing") break;
    if (!subscriptionData.is_credit && !subscriptionData.is_custom) {
      if (
        subscriptionData.subscription_status === "active" &&
        subscriptionData.quantity > 0
      ) {
        const obj = await getActiveTeamMemberCount(req.user?.owner_id ?? "");

        const userActiveInOtherTeams = await this.checkIfUserActiveInOtherTeams(
          req.user?.owner_id as string,
          req.query?.email as string
        );

        if (!userActiveInOtherTeams) {
          const response = await updateUsers(
            subscriptionData.subscription_ref ?? subscriptionData.subscription_id,
            obj.user_count
          );
          if (!response.body.subscription_id)
            return res
              .status(200)
              .send(
                new ServerResponse(
                  false,
                  response.message || "Please check your subscription."
                )
              );
        }
      }
    }

    const actorUserId = req.user?.id ?? null;

    NotificationsService.sendNotificationToUser(
      data.member.id,
      actorUserId,
      data.member.team,
      teamId,
      message,
    );

    IO.emitByUserId(
      data.member.id,
      actorUserId,
      SocketEvents.TEAM_MEMBER_REMOVED,
      {
        teamId: teamId,
        message,
        removedUserId: data.member.id,
      }
    );
    return res
      .status(200)
      .send(new ServerResponse(true, result.rows, "Team member deleted successfully."));
  }
}
