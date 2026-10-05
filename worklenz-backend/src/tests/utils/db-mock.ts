import { QueryResult, QueryResultRow } from "pg";

export interface MockDbResult<T = any> {
  rows: T[];
  rowCount: number;
  command?: string;
  oid?: number;
  fields?: any[];
}

export const createQueryResult = <T extends QueryResultRow = any>(rows: T[] = [], rowCount?: number): QueryResult<T> => {
  return {
    rows,
    rowCount: rowCount !== undefined ? rowCount : rows.length,
    command: "SELECT",
    oid: 0,
    fields: [],
  };
};

export const createMockDb = () => {
  const query = jest.fn().mockResolvedValue(createQueryResult([]));
  const connect = jest.fn();

  const mockClient = {
    query: jest.fn().mockResolvedValue(createQueryResult([])),
    release: jest.fn(),
  };

  connect.mockResolvedValue(mockClient);

  return {
    query,
    connect,
    mockClient,
    mockQueryResult: <T extends QueryResultRow = any>(rows: T[], rowCount?: number) => {
      query.mockResolvedValueOnce(createQueryResult(rows, rowCount));
    },
    mockQueryEmpty: () => {
      query.mockResolvedValueOnce(createQueryResult([]));
    },
    mockQueryError: (error: Error | string) => {
      query.mockRejectedValueOnce(typeof error === "string" ? new Error(error) : error);
    },
  };
};
