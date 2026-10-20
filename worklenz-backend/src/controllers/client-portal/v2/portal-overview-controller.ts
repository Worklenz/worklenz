import db from "../../../config/db";
import { getOverview, parseWidgetKeys } from "../../../services/client-portal-v2/overview.service";
import {
  getOverviewLayout,
  resetOverviewLayout,
  saveOverviewLayout,
} from "../../../services/client-portal-v2/overview-layout.service";
import { asString, bodyOf, ok, portalHandler, staffContext } from "./portal-http";

/** Client Portal v2 admin Overview: widget data and each user's saved widget layout. */
export default class PortalOverviewController {
  /** GET /portal/v2/overview?widgets=a,b - keyed `{ data }` or `{ error }` per widget; omit `widgets` for all. */
  static overview = portalHandler("Failed to load the overview", async (req, res) => {
    const { teamId, userId } = staffContext(req);
    const keys = parseWidgetKeys(asString(req.query.widgets));
    ok(res, await getOverview(teamId, userId, keys));
  });

  /** GET /portal/v2/overview/layout */
  static getLayout = portalHandler("Failed to load the overview layout", async (req, res) => {
    const { teamId, userId } = staffContext(req);
    ok(res, await getOverviewLayout(db, teamId, userId));
  });

  /** PUT /portal/v2/overview/layout - body: { layout: [{ key, size, visible }] } */
  static saveLayout = portalHandler("Failed to save the overview layout", async (req, res) => {
    const { teamId, userId } = staffContext(req);
    ok(res, await saveOverviewLayout(db, teamId, userId, bodyOf(req).layout), "Layout saved");
  });

  /** DELETE /portal/v2/overview/layout - back to the default layout. */
  static resetLayout = portalHandler("Failed to reset the overview layout", async (req, res) => {
    const { teamId, userId } = staffContext(req);
    ok(res, await resetOverviewLayout(db, teamId, userId));
  });
}
