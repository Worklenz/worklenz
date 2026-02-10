import { forEach } from "lodash";
import { DEFAULT_PAGE_SIZE } from "../shared/constants";
import { toTsQuery } from "../shared/utils";

export default abstract class WorklenzControllerBase {

  protected static get paginatedDatasetDefaultStruct() {
    return { total: 0, data: [] };
  }

  protected static isValidHost(hostname: string) {
    return hostname === "worklenz.com"
      || hostname === "www.worklenz.com"
      || hostname === "dev.worklenz.com"
      || hostname === "uat.worklenz.com";
  }

  public static createTagList(list: Array<{ name?: string; end?: boolean; names?: string[]; }>, max = 4) {
    let data = [...(list || [])];
    if (data.length > max) {
      const remaining = list.slice(max);
      const names = remaining.map(i => i.name);
      data = data.slice(0, max);
      data.push({ name: `+${remaining.length}`, end: true, names: names as string[] });
    }

    return data;
  }

  protected static toPaginationOptions(queryParams: any, searchField: string | string[], isMemberFilter = false, paramOffset?: number) {
    // Pagination
    const size = +(queryParams.size || DEFAULT_PAGE_SIZE);
    const index = +(queryParams.index || 1);
    const offset = queryParams.search ? 0 : (index - 1) * size;
    const paging = queryParams.paging || "true";

    const search = (queryParams.search as string || "").trim();

    let searchQuery = "";
    const searchParams: any[] = [];

    if (search && paramOffset !== undefined) {
      // Use parameterized queries when paramOffset is provided
      const escapedSearch = search.replace(/'/g, "''");

      let s = "";
      if (typeof searchField === "string") {
        s = ` ${searchField} ILIKE $${paramOffset}`;
        searchParams.push(`%${escapedSearch}%`);
      } else if (Array.isArray(searchField)) {
        s = searchField.map((field, idx) => {
          searchParams.push(`%${escapedSearch}%`);
          return ` ${field} ILIKE $${paramOffset + idx}`;
        }).join(" OR ");
      }

      if (s) {
        searchQuery = isMemberFilter ? ` (${s})  AND ` : ` AND (${s}) `;
      }
    } else if (search) {
      // Fallback to inline search for backward compatibility
      const escapedSearch = search.replace(/'/g, "''");

      let s = "";
      if (typeof searchField === "string") {
        s = ` ${searchField} ILIKE '%${escapedSearch}%'`;
      } else if (Array.isArray(searchField)) {
        s = searchField.map(field => ` ${field} ILIKE '%${escapedSearch}%'`).join(" OR ");
      }

      if (s) {
        searchQuery = isMemberFilter ? ` (${s})  AND ` : ` AND (${s}) `;
      }
    }

    // Sort - validate field and order
    const field = queryParams.field;
    let sortField = searchField;

    // Only use provided field if it's NOT literally "null" or "undefined" and is a valid string
    if (field && field !== "null" && field !== "undefined" && typeof field === 'string' && field.trim().length > 0) {
      sortField = field;
    }

    const sortOrder = queryParams.order === "descend" ? "desc" : "asc";

    return { searchQuery, searchParams, sortField, sortOrder, size, offset, paging };
  }

}
