export interface MockRequestOptions {
  user?: any;
  params?: Record<string, any>;
  query?: Record<string, any>;
  body?: Record<string, any>;
  headers?: Record<string, any>;
  path?: string;
  originalUrl?: string;
  method?: string;
}

export const createMockRequest = (options: MockRequestOptions = {}) => {
  return {
    user: "user" in options ? options.user : {
      id: "user-123",
      email: "test@worklenz.com",
      team_id: "team-123",
      name: "Test User",
    },
    params: options.params ?? {},
    query: options.query ?? {},
    body: options.body ?? {},
    headers: options.headers ?? {},
    path: options.path ?? "/",
    originalUrl: options.originalUrl ?? "/",
    method: options.method ?? "GET",
  } as any;
};

export const createMockResponse = () => {
  const res: any = {
    statusCode: 200,
    headersSent: false,
  };

  res.status = jest.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });

  res.send = jest.fn().mockImplementation((body?: any) => {
    res.body = body;
    return res;
  });

  res.json = jest.fn().mockImplementation((data?: any) => {
    res.body = data;
    return res;
  });

  res.sendStatus = jest.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });

  res.setHeader = jest.fn().mockReturnThis();
  res.getHeader = jest.fn();
  res.end = jest.fn().mockReturnThis();

  return res;
};
