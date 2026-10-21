import axios from 'axios';

/** Error responses from the API are already announced by the api-client interceptor. */
export const isAnnouncedApiError = (error: unknown): boolean =>
  axios.isAxiosError(error) && !!error.response;
