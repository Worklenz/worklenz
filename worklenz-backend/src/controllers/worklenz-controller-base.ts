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

  protected static toPaginationOptions(queryParams: any, searchField: string | string[], isMemberFilter = false) {
    // Pagination
    const size = +(queryParams.size || DEFAULT_PAGE_SIZE);
    const index = +(queryParams.index || 1);
    const offset = queryParams.search ? 0 : (index - 1) * size;
    const paging = queryParams.paging || "true";

    // let s = "";
    // if (typeof searchField === "string") {
    //   s = `${searchField} || ' ' || id::TEXT`;
    // } else if (Array.isArray(searchField)) {
    //   s = searchField.join(" || ' ' || ");
    // }

    // const search = (queryParams.search as string || "").trim();
    // const searchQuery = search ? `AND TO_TSVECTOR(${s}) @@ TO_TSQUERY('${toTsQuery(search)}')` : "";

    const search = (queryParams.search as string || "").trim();

    let s = "";
    if (typeof searchField === "string") {
      s = ` ${searchField} ILIKE '%${search}%'`;
    } else if (Array.isArray(searchField)) {
      s = searchField.map(index => ` ${index} ILIKE '%${search}%'`).join(" OR ");
    }

    let searchQuery = "";

    if (search) {
      searchQuery = isMemberFilter ? ` (${s})  AND ` : ` AND (${s}) `;
    }

    // Sort
    const sortField = /null|undefined/.test(queryParams.field as string) ? searchField : queryParams.field;
    const sortOrder = queryParams.order === "descend" ? "desc" : "asc";

    return {searchQuery, sortField, sortOrder, size, offset, paging};
  }

}
