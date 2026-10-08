import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { actorFromSessionUser, logAuditEvent } from "../services/audit-log.service";
import { AUDIT_EVENT_TYPE } from "../shared/audit-log-constants";
import {
  AUDIT_LOG_RETENTION_DEFAULT_MONTHS,
  AUDIT_LOG_RETENTION_MAX_MONTHS,
  AUDIT_LOG_RETENTION_MIN_MONTHS,
  AUDIT_LOG_RETENTION_OPTIONS,
  AUDIT_LOG_RETENTION_PCI_MIN_MONTHS,
  parseRetentionMonths,
} from "../shared/audit-log-retention";
import { getEffectiveTeamRole, TEAM_ROLE_NAMES } from "../shared/team-permissions";

/**
 * Audit Log retention setting (Audit log spec, task 6.1), stored on
 * organizations.audit_log_retention_months. Mounted at
 * /api/v1/admin-center/organization/audit-log/retention.
 *
 * Changing this value never deletes anything directly: entries are only ever removed by the
 * scheduled retention job (cron_jobs/audit-log-retention-job.ts), which reads this setting.
 */
export default class AuditLogRetentionController extends WorklenzControllerBase {
  /** GET — readable by anyone who can view the audit log; `can_edit` is true only for the Owner. */
  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;
    if (!organizationId) {
      return res.status(200).send(new ServerResponse(false, null, "Organization not found"));
    }

    const result = await db.query(
      `SELECT audit_log_retention_months FROM organizations WHERE id = $1::UUID;`,
      [organizationId]
    );
    if (!result.rows.length) {
      return res.status(404).send(new ServerResponse(false, null, "Organization not found"));
    }

    return res.status(200).send(
      new ServerResponse(true, {
        ...buildRetentionPolicy(result.rows[0].audit_log_retention_months),
        can_edit: getEffectiveTeamRole(req.user) === TEAM_ROLE_NAMES.OWNER,
      })
    );
  }

  /** PUT { retention_months } — Owner only (enforced by auditLogOwnerValidator at the route). */
  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;
    if (!organizationId || !req.user) {
      return res.status(200).send(new ServerResponse(false, null, "Organization not found"));
    }

    const retentionMonths = parseRetentionMonths(req.body?.retention_months);
    if (retentionMonths === null) {
      return res.status(400).send(
        new ServerResponse(
          false,
          null,
          `Retention must be a whole number of months between ${AUDIT_LOG_RETENTION_MIN_MONTHS} and ${AUDIT_LOG_RETENTION_MAX_MONTHS}`
        )
      );
    }

    const previous = await db.query(
      `SELECT audit_log_retention_months FROM organizations WHERE id = $1::UUID;`,
      [organizationId]
    );
    if (!previous.rows.length) {
      return res.status(404).send(new ServerResponse(false, null, "Organization not found"));
    }
    const previousMonths: number = previous.rows[0].audit_log_retention_months;

    if (previousMonths !== retentionMonths) {
      await db.query(
        `UPDATE organizations SET audit_log_retention_months = $2 WHERE id = $1::UUID;`,
        [organizationId, retentionMonths]
      );

      logAuditEvent({
        organizationId,
        actor: actorFromSessionUser(req.user),
        eventType: AUDIT_EVENT_TYPE.RETENTION_WINDOW_CHANGED.id,
        description: `Audit log retention changed from ${previousMonths} to ${retentionMonths} months`,
        oldValue: String(previousMonths),
        newValue: String(retentionMonths),
      });
    }

    return res.status(200).send(
      new ServerResponse(true, { ...buildRetentionPolicy(retentionMonths), can_edit: true })
    );
  }
}

const buildRetentionPolicy = (retentionMonths: number) => ({
  retention_months: retentionMonths,
  min_months: AUDIT_LOG_RETENTION_MIN_MONTHS,
  max_months: AUDIT_LOG_RETENTION_MAX_MONTHS,
  default_months: AUDIT_LOG_RETENTION_DEFAULT_MONTHS,
  pci_min_months: AUDIT_LOG_RETENTION_PCI_MIN_MONTHS,
  options: [...AUDIT_LOG_RETENTION_OPTIONS],
});
