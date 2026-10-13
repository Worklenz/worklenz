import {
  buildAuditEventsWhereClause,
  matchingEventTypeIdsForSearch,
  parseAuditLogFilters,
} from "../shared/audit-log-query";

describe("audit-log-query", () => {
  describe("parseAuditLogFilters", () => {
    it("defaults everything to empty when no query params are given", () => {
      expect(parseAuditLogFilters({})).toEqual({
        startDate: "",
        endDate: "",
        categories: [],
        actorUserIds: [],
        search: "",
        timezone: "",
      });
    });

    it("keeps a known viewer timezone and drops an unknown one", () => {
      expect(parseAuditLogFilters({}, "Asia/Colombo").timezone).toBe("Asia/Colombo");
      expect(parseAuditLogFilters({}, "Mars/Olympus_Mons").timezone).toBe("");
      expect(parseAuditLogFilters({}, null).timezone).toBe("");
    });

    it("keeps strict calendar dates and trims the search value", () => {
      const filters = parseAuditLogFilters({
        start_date: "  2026-09-01  ",
        end_date: "  2026-09-30  ",
        search: "  fraud  ",
      });
      expect(filters.startDate).toBe("2026-09-01");
      expect(filters.endDate).toBe("2026-09-30");
      expect(filters.search).toBe("fraud");
    });

    it("drops malformed or impossible dates before they reach the SQL DATE casts", () => {
      const filters = parseAuditLogFilters({
        start_date: "not-a-date",
        end_date: "2026-02-30",
      });

      expect(filters.startDate).toBe("");
      expect(filters.endDate).toBe("");
    });

    it("treats non-string search parameters as empty instead of throwing", () => {
      expect(parseAuditLogFilters({ search: ["unexpected"] })).toMatchObject({ search: "" });
      expect(parseAuditLogFilters({ search: { value: "unexpected" } })).toMatchObject({ search: "" });
    });

    it("splits comma-separated categories and drops invalid ones", () => {
      const filters = parseAuditLogFilters({ category: "access, user ,bogus" });
      expect(filters.categories).toEqual(["access", "user"]);
    });

    it("keeps only valid UUID actor ids so the UUID[] SQL cast cannot fail", () => {
      const filters = parseAuditLogFilters({
        actor_user_id: "550e8400-e29b-41d4-a716-446655440000, not-a-uuid, 550e8400-e29b-41d4-a716-446655440001",
      });
      expect(filters.actorUserIds).toEqual([
        "550e8400-e29b-41d4-a716-446655440000",
        "550e8400-e29b-41d4-a716-446655440001",
      ]);
    });
  });

  describe("matchingEventTypeIdsForSearch", () => {
    it("finds every event type whose label contains the search term", () => {
      const ids = matchingEventTypeIdsForSearch("login");
      expect(ids).toEqual(expect.arrayContaining(["login_success", "login_failed"]));
    });

    it("is case-insensitive", () => {
      expect(matchingEventTypeIdsForSearch("LOGIN")).toEqual(matchingEventTypeIdsForSearch("login"));
    });

    it("returns an empty array when nothing matches", () => {
      expect(matchingEventTypeIdsForSearch("xyz-no-such-label")).toEqual([]);
    });
  });

  describe("buildAuditEventsWhereClause", () => {
    const emptyFilters = { startDate: "", endDate: "", categories: [], actorUserIds: [], search: "" };

    it("scopes to organization_id with no other filters", () => {
      const { whereClause, params, nextParamIndex } = buildAuditEventsWhereClause("org-1", emptyFilters);
      expect(whereClause).toBe("organization_id = $1");
      expect(params).toEqual(["org-1"]);
      expect(nextParamIndex).toBe(2);
    });

    it("adds a date-range condition only for the params actually provided", () => {
      const { whereClause, params, nextParamIndex } = buildAuditEventsWhereClause("org-1", {
        ...emptyFilters,
        startDate: "2026-09-01",
        endDate: "2026-09-30",
      });
      expect(whereClause).toBe(
        "organization_id = $1 AND created_at >= $2::DATE AND created_at < ($3::DATE + INTERVAL '1 day')"
      );
      expect(params).toEqual(["org-1", "2026-09-01", "2026-09-30"]);
      expect(nextParamIndex).toBe(4);
    });

    it("treats the dates as calendar days in the viewer's timezone when one is known", () => {
      const { whereClause, params, nextParamIndex } = buildAuditEventsWhereClause("org-1", {
        ...emptyFilters,
        startDate: "2026-10-06",
        endDate: "2026-10-06",
        timezone: "Asia/Colombo",
      });
      expect(whereClause).toBe(
        "organization_id = $1 AND created_at >= ($2::DATE)::TIMESTAMP AT TIME ZONE $3::TEXT" +
          " AND created_at < (($4::DATE + 1)::TIMESTAMP AT TIME ZONE $3::TEXT)"
      );
      expect(params).toEqual(["org-1", "2026-10-06", "Asia/Colombo", "2026-10-06"]);
      expect(nextParamIndex).toBe(5);
    });

    it("does not send the timezone when there is no date filter", () => {
      const { whereClause, params } = buildAuditEventsWhereClause("org-1", { ...emptyFilters, timezone: "Asia/Colombo" });
      expect(whereClause).toBe("organization_id = $1");
      expect(params).toEqual(["org-1"]);
    });

    it("matches % and _ in the search literally", () => {
      const { params } = buildAuditEventsWhereClause("org-1", { ...emptyFilters, search: "50%_off" });
      expect(params[1]).toBe("%50\\%\\_off%");
    });

    it("adds a category ANY() condition for multi-select categories", () => {
      const { whereClause, params } = buildAuditEventsWhereClause("org-1", {
        ...emptyFilters,
        categories: ["access", "user"],
      });
      expect(whereClause).toBe("organization_id = $1 AND category = ANY($2::TEXT[])");
      expect(params[1]).toEqual(["access", "user"]);
    });

    it("adds an actor ANY() condition for multi-select actors", () => {
      const { whereClause, params } = buildAuditEventsWhereClause("org-1", {
        ...emptyFilters,
        actorUserIds: ["550e8400-e29b-41d4-a716-446655440000", "550e8400-e29b-41d4-a716-446655440001"],
      });
      expect(whereClause).toBe("organization_id = $1 AND actor_user_id = ANY($2::UUID[])");
      expect(params[1]).toEqual(["550e8400-e29b-41d4-a716-446655440000", "550e8400-e29b-41d4-a716-446655440001"]);
    });

    it("adds a search condition against description and actor_name", () => {
      const { whereClause, params } = buildAuditEventsWhereClause("org-1", {
        ...emptyFilters,
        search: "fraud",
      });
      expect(whereClause).toBe("organization_id = $1 AND (description ILIKE $2 OR actor_name ILIKE $3)");
      expect(params).toEqual(["org-1", "%fraud%", "%fraud%"]);
    });

    it("extends the search condition with event_type labels when the term matches one", () => {
      const { whereClause, params } = buildAuditEventsWhereClause("org-1", {
        ...emptyFilters,
        search: "login",
      });
      expect(whereClause).toBe(
        "organization_id = $1 AND ((description ILIKE $2 OR actor_name ILIKE $3) OR event_type = ANY($4::TEXT[]))"
      );
      expect(params[3]).toEqual(expect.arrayContaining(["login_success", "login_failed"]));
    });

    it("combines every filter together with the right placeholder sequence", () => {
      const { whereClause, params, nextParamIndex } = buildAuditEventsWhereClause("org-1", {
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        categories: ["lifecycle"],
        actorUserIds: ["550e8400-e29b-41d4-a716-446655440000"],
        search: "fraud",
      });
      expect(whereClause).toBe(
        "organization_id = $1 AND created_at >= $2::DATE AND created_at < ($3::DATE + INTERVAL '1 day')" +
          " AND category = ANY($4::TEXT[]) AND actor_user_id = ANY($5::UUID[])" +
          " AND (description ILIKE $6 OR actor_name ILIKE $7)"
      );
      expect(params[0]).toBe("org-1");
      expect(nextParamIndex).toBe(8);
    });
  });
});
