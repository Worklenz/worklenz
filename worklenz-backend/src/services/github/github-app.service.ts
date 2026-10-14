import jwt from "jsonwebtoken";
import { log_error } from "../../shared/utils";

const GITHUB_API = "https://api.github.com";
const API_VERSION = "2022-11-28";
const MAX_RETRIES = 3;

export interface IGithubAppConfig {
  appId: string;
  slug: string;
  privateKey: string;
  webhookSecret: string;
  clientId: string;
  clientSecret: string;
}

export interface IGithubInstallation {
  id: number;
  account: { login: string; type: string; avatar_url?: string };
  suspended_at?: string | null;
}

export interface IGithubRepo {
  id: number;
  full_name: string;
  default_branch: string;
  private: boolean;
}

export class GithubApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Normalise a PEM that may be base64 encoded or have escaped newlines. */
function normalisePrivateKey(raw: string): string {
  const value = raw.trim();
  if (value.includes("BEGIN")) return value.replace(/\\n/g, "\n");
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    if (decoded.includes("BEGIN")) return decoded;
  } catch {
    // fall through
  }
  return value;
}

export class GithubAppService {
  private static tokenCache = new Map<number, { token: string; expiresAt: number }>();

  /** Returns null when the deployment has not configured a GitHub App. */
  public static getConfig(): IGithubAppConfig | null {
    const appId = process.env.GITHUB_APP_ID;
    const slug = process.env.GITHUB_APP_SLUG;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
    const webhookSecret = process.env.GITHUB_APP_WEBHOOK_SECRET;
    const clientId = process.env.GITHUB_APP_CLIENT_ID;
    const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;
    if (!appId || !slug || !privateKey || !webhookSecret || !clientId || !clientSecret) return null;
    return {
      appId,
      slug,
      privateKey: normalisePrivateKey(privateKey),
      webhookSecret,
      clientId,
      clientSecret,
    };
  }

  public static isConfigured(): boolean {
    return this.getConfig() !== null;
  }

  private static getAppJwt(config: IGithubAppConfig): string {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign({ iat: now - 60, exp: now + 9 * 60, iss: config.appId }, config.privateKey, {
      algorithm: "RS256",
    });
  }

  private static async request<T>(
    path: string,
    token: string,
    init: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    let attempt = 0;
    for (;;) {
      const response = await fetch(`${GITHUB_API}${path}`, {
        method: init.method || "GET",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": API_VERSION,
          "User-Agent": "Worklenz",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
      });

      const rateLimited =
        response.status === 429 ||
        (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0");
      const retriable = rateLimited || response.status >= 500;

      if (retriable && attempt < MAX_RETRIES) {
        const retryAfter = parseInt(response.headers.get("retry-after") || "", 10);
        const delayMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 500 * 2 ** attempt;
        attempt++;
        await sleep(Math.min(delayMs, 15000));
        continue;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new GithubApiError(response.status, `GitHub API ${response.status}: ${text.slice(0, 300)}`);
      }
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    }
  }

  /** Short-lived installation token, cached until shortly before expiry. */
  public static async getInstallationToken(installationId: number): Promise<string> {
    const cached = this.tokenCache.get(installationId);
    if (cached && cached.expiresAt - Date.now() > 60_000) return cached.token;

    const config = this.getConfig();
    if (!config) throw new Error("GitHub App is not configured");

    const result = await this.request<{ token: string; expires_at: string }>(
      `/app/installations/${installationId}/access_tokens`,
      this.getAppJwt(config),
      { method: "POST" },
    );
    this.tokenCache.set(installationId, {
      token: result.token,
      expiresAt: new Date(result.expires_at).getTime(),
    });
    return result.token;
  }

  public static async getInstallation(installationId: number): Promise<IGithubInstallation> {
    const config = this.getConfig();
    if (!config) throw new Error("GitHub App is not configured");
    return this.request<IGithubInstallation>(`/app/installations/${installationId}`, this.getAppJwt(config));
  }

  /** All repositories the installation can access (paginated). */
  public static async listInstallationRepositories(installationId: number): Promise<IGithubRepo[]> {
    const token = await this.getInstallationToken(installationId);
    const repos: IGithubRepo[] = [];
    for (let page = 1; page <= 20; page++) {
      const result = await this.request<{ repositories: IGithubRepo[] }>(
        `/installation/repositories?per_page=100&page=${page}`,
        token,
      );
      repos.push(...result.repositories);
      if (result.repositories.length < 100) break;
    }
    return repos;
  }

  /** Head SHA of a branch, used as the starting point for a new branch. */
  public static async getBranchSha(
    installationId: number,
    fullName: string,
    branch: string,
  ): Promise<string> {
    const token = await this.getInstallationToken(installationId);
    const ref = await this.request<{ object: { sha: string } }>(
      `/repos/${fullName}/git/ref/heads/${branch.split("/").map(encodeURIComponent).join("/")}`,
      token,
    );
    return ref.object.sha;
  }

  public static async createBranch(
    installationId: number,
    fullName: string,
    name: string,
    sha: string,
  ): Promise<void> {
    const token = await this.getInstallationToken(installationId);
    await this.request(`/repos/${fullName}/git/refs`, token, {
      method: "POST",
      body: { ref: `refs/heads/${name}`, sha },
    });
  }

  /**
   * Exchange the OAuth `code` from the install redirect and confirm the signed-in GitHub
   * user can really access `installationId`. Prevents attaching someone else's installation.
   */
  public static async userCanAccessInstallation(code: string, installationId: number): Promise<boolean> {
    const config = this.getConfig();
    if (!config) return false;
    try {
      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "Worklenz" },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
        }),
      });
      const tokenBody = (await tokenResponse.json()) as { access_token?: string };
      if (!tokenBody.access_token) return false;

      const result = await this.request<{ installations: { id: number }[] }>(
        "/user/installations?per_page=100",
        tokenBody.access_token,
      );
      return result.installations.some(item => item.id === installationId);
    } catch (error) {
      log_error(error);
      return false;
    }
  }
}
