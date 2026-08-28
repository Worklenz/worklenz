export class TokenManager {
  private static readonly TOKEN_KEY = "clientToken";
  private static readonly TOKEN_EXPIRY_KEY = "clientTokenExpiry";
  private static readonly REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry

  static setToken(token: string, expiresAt?: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    if (expiresAt) {
      localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiresAt);
    }
  }

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static getTokenExpiry(): string | null {
    return localStorage.getItem(this.TOKEN_EXPIRY_KEY);
  }

  static clearToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
  }

  static isTokenValid(): boolean {
    const token = this.getToken();
    if (!token) return false;

    const expiry = this.getTokenExpiry();
    if (!expiry) return true; // If no expiry, assume valid

    const expiryTime = new Date(expiry).getTime();
    const currentTime = new Date().getTime();

    return currentTime < expiryTime;
  }

  static isTokenExpired(): boolean {
    return !this.isTokenValid();
  }

  static shouldRefreshToken(): boolean {
    const token = this.getToken();
    if (!token) return false;

    const expiry = this.getTokenExpiry();
    if (!expiry) return false;

    const expiryTime = new Date(expiry).getTime();
    const currentTime = new Date().getTime();

    // Refresh if token expires within the threshold
    return expiryTime - currentTime < this.REFRESH_THRESHOLD;
  }

  static getTimeUntilExpiry(): number {
    const expiry = this.getTokenExpiry();
    if (!expiry) return Infinity;

    const expiryTime = new Date(expiry).getTime();
    const currentTime = new Date().getTime();

    return Math.max(0, expiryTime - currentTime);
  }

  static formatTimeUntilExpiry(): string {
    const timeLeft = this.getTimeUntilExpiry();

    if (timeLeft === Infinity) return "Never expires";
    if (timeLeft <= 0) return "Expired";

    const hours = Math.floor(timeLeft / (60 * 60 * 1000));
    const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  static startTokenExpiryCheck(
    onExpiry: () => void,
    checkInterval: number = 60000
  ): () => void {
    const interval = setInterval(() => {
      if (this.isTokenExpired()) {
        onExpiry();
        clearInterval(interval);
      }
    }, checkInterval);

    return () => clearInterval(interval);
  }

  static startTokenRefreshCheck(
    onRefresh: () => void,
    checkInterval: number = 60000
  ): () => void {
    const interval = setInterval(() => {
      if (this.shouldRefreshToken()) {
        onRefresh();
      }
    }, checkInterval);

    return () => clearInterval(interval);
  }
}

export default TokenManager;
