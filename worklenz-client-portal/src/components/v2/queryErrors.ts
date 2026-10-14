/** The HTTP status of an RTK Query error, or undefined for anything else. */
export const errorStatus = (error: unknown): number | undefined => {
  const status = (error as { status?: unknown } | undefined)?.status;
  return typeof status === 'number' ? status : undefined;
};

/** The portal error code (`error.data.body.code`), e.g. NOT_FOUND, ROLE_FORBIDDEN, COMMENT_REQUIRED. */
export const errorCode = (error: unknown): string | undefined => {
  const code = (error as { data?: { body?: { code?: unknown } } } | undefined)?.data?.body?.code;
  return typeof code === 'string' ? code : undefined;
};

/** The server's message for a failed request, if it sent one. */
export const errorMessage = (error: unknown): string | undefined => {
  const message = (error as { data?: { message?: unknown } } | undefined)?.data?.message;
  return typeof message === 'string' && message ? message : undefined;
};
