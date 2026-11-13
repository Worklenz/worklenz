import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { getBackdateViolation } from "../../shared/timelog-backdate-restriction";
import { getProjectStartDateViolation } from "../../shared/timelog-project-date-restriction";
import { isTeamAdmin, isTeamOwner } from "../../shared/team-permissions";

interface SplitSegment {
  seconds_spent: number;
  formatted_start: string;
}

function isValidSegment(segment: unknown): segment is SplitSegment {
  if (!segment || typeof segment !== "object") return false;

  const value = segment as Partial<SplitSegment>;
  return (
    typeof value.seconds_spent === "number" &&
    Number.isFinite(value.seconds_spent) &&
    value.seconds_spent > 0 &&
    typeof value.formatted_start === "string" &&
    !Number.isNaN(Date.parse(value.formatted_start))
  );
}

export default async function timeEntrySplitValidator(
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
): Promise<IWorkLenzResponse | void> {
  const { segment1, segment2 } = req.body || {};
  if (!isValidSegment(segment1) || !isValidSegment(segment2)) {
    return res.status(400).send(
      new ServerResponse(false, null, "Both split segments must include a positive duration and valid start time.")
    );
  }

  const canEditOthers = isTeamOwner(req.user) || isTeamAdmin(req.user);
  const segments = [segment1, segment2];

  for (const [index, segment] of segments.entries()) {
    const projectViolation = await getProjectStartDateViolation({
      workLogId: req.params.id,
      formattedStart: segment.formatted_start,
      userId: req.user?.id,
      allowUnchangedDate: index === 0,
    });
    if (projectViolation) {
      return res.status(400).send(new ServerResponse(false, null, projectViolation));
    }

    const backdateViolation = await getBackdateViolation(
      segment.formatted_start,
      req.user?.id,
      req.user?.team_id,
      index === 0 ? req.params.id : null,
      index === 0 && canEditOthers
    );
    if (backdateViolation) {
      return res.status(400).send(new ServerResponse(false, null, backdateViolation));
    }
  }

  return next();
}
