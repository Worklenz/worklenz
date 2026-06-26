import { forEach } from "lodash";
import {DEFAULT_PAGE_SIZE} from "../shared/constants";
import {toTsQuery} from "../shared/utils";

export default abstract class WorklenzControllerBase {

  protected static get paginatedDatasetDefaultStruct() {
    return {total: 0, data: []};
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
      data.push({name: `+${remaining.length}`, end: true, names: names as string[]});
    }

    return data;
  }

  protected static toPaginationOptions(queryParams: any, searchField: string | string[], isMemberFilter = false, paramOffset = 1) {
    // Pagination
    const size = +(queryParams.size || DEFAULT_PAGE_SIZE);
    const index = +(queryParams.index || 1);
    const offset = (index - 1) * size;
    const paging = queryParams.paging || "true";

    const search = (queryParams.search as string || "").trim();

    let searchQuery = "";
    let searchParams: string[] = [];

    if (search) {
      // Use parameterized queries instead of string interpolation
      const searchPattern = `%${search}%`;
      let s = "";
      let currentParam = paramOffset;
      
      if (typeof searchField === "string") {
        s = ` ${searchField} ILIKE $${currentParam}`;
        searchParams.push(searchPattern);
      } else if (Array.isArray(searchField)) {
        const conditions = searchField.map(field => {
          const param = `$${currentParam}`;
          currentParam++;
          searchParams.push(searchPattern);
          return ` ${field} ILIKE ${param}`;
        });
        s = conditions.join(" OR ");
      }

      if (s) {
        searchQuery = isMemberFilter ? ` (${s})  AND ` : ` AND (${s}) `;
      }
    }

    // Sort
    const sortField = /null|undefined/.test(queryParams.field as string) ? searchField : queryParams.field;
    // Handle both uppercase (ASC/DESC) and lowercase (asc/desc/ascend/descend) order values
    const orderValue = (queryParams.order as string || "").toLowerCase();
    const sortOrder = (orderValue === "desc" || orderValue === "descend") ? "desc" : "asc";

    return {searchQuery, searchParams, sortField, sortOrder, size, offset, paging};
  }

}
