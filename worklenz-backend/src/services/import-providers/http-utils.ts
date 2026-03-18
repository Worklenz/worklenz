import axios, { AxiosRequestConfig } from "axios";

export async function getWithRetries<T>(
  config: AxiosRequestConfig,
  retries = 2,
  backoffMs = 500
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      const { data } = await axios(config);
      return data as T;
    } catch (err: any) {
      const status = err?.response?.status;
      if (attempt >= retries || (status && status < 500 && status !== 429))
        throw err;
      const delay = backoffMs * Math.pow(2, attempt);
      await new Promise((res) => setTimeout(res, delay));
      attempt += 1;
    }
  }
}
