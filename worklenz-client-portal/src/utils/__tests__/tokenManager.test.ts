import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TokenManager from '../tokenManager';

describe('TokenManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('token persistence and retrieval', () => {
    it('should store and retrieve token without expiry', () => {
      TokenManager.setToken('sample-client-token');
      expect(TokenManager.getToken()).toBe('sample-client-token');
      expect(TokenManager.getTokenExpiry()).toBeNull();
      expect(TokenManager.isTokenValid()).toBe(true);
      expect(TokenManager.isTokenExpired()).toBe(false);
    });

    it('should store and retrieve token with expiry date', () => {
      const futureDate = new Date(Date.now() + 3600 * 1000).toISOString();
      TokenManager.setToken('sample-client-token', futureDate);

      expect(TokenManager.getToken()).toBe('sample-client-token');
      expect(TokenManager.getTokenExpiry()).toBe(futureDate);
      expect(TokenManager.isTokenValid()).toBe(true);
    });

    it('should clear token and expiry on clearToken()', () => {
      TokenManager.setToken('token-to-delete', new Date().toISOString());
      TokenManager.clearToken();

      expect(TokenManager.getToken()).toBeNull();
      expect(TokenManager.getTokenExpiry()).toBeNull();
      expect(TokenManager.isTokenValid()).toBe(false);
      expect(TokenManager.isTokenExpired()).toBe(true);
    });
  });

  describe('token expiration checks', () => {
    it('should identify expired tokens', () => {
      const pastDate = new Date(Date.now() - 60 * 1000).toISOString();
      TokenManager.setToken('expired-token', pastDate);

      expect(TokenManager.isTokenValid()).toBe(false);
      expect(TokenManager.isTokenExpired()).toBe(true);
    });

    it('should return shouldRefreshToken = true when token expires within 5 minutes threshold', () => {
      // 3 minutes remaining
      const nearExpiryDate = new Date(Date.now() + 3 * 60 * 1000).toISOString();
      TokenManager.setToken('near-expiry-token', nearExpiryDate);

      expect(TokenManager.shouldRefreshToken()).toBe(true);
    });

    it('should return shouldRefreshToken = false when token has plenty of time remaining', () => {
      // 1 hour remaining
      const farExpiryDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      TokenManager.setToken('fresh-token', farExpiryDate);

      expect(TokenManager.shouldRefreshToken()).toBe(false);
    });

    it('should return shouldRefreshToken = false when token has no expiry', () => {
      TokenManager.setToken('no-expiry-token');
      expect(TokenManager.shouldRefreshToken()).toBe(false);
    });
  });

  describe('formatTimeUntilExpiry', () => {
    it('should return "Never expires" when no expiry is set', () => {
      TokenManager.setToken('token');
      expect(TokenManager.formatTimeUntilExpiry()).toBe('Never expires');
    });

    it('should return "Expired" when expiry is in the past', () => {
      const pastDate = new Date(Date.now() - 10000).toISOString();
      TokenManager.setToken('token', pastDate);
      expect(TokenManager.formatTimeUntilExpiry()).toBe('Expired');
    });

    it('should format remaining hours and minutes', () => {
      // 2 hours, 15 minutes, 30 seconds
      const futureDate = new Date(Date.now() + (2 * 3600 + 15 * 60 + 30) * 1000).toISOString();
      TokenManager.setToken('token', futureDate);
      expect(TokenManager.formatTimeUntilExpiry()).toBe('2h 15m');
    });

    it('should format remaining minutes and seconds when under 1 hour', () => {
      // 5 minutes, 20 seconds
      const futureDate = new Date(Date.now() + (5 * 60 + 20) * 1000 + 500).toISOString();
      TokenManager.setToken('token', futureDate);
      expect(TokenManager.formatTimeUntilExpiry()).toMatch(/5m (19|20)s/);
    });

    it('should format seconds only when under 1 minute', () => {
      const futureDate = new Date(Date.now() + 45 * 1000 + 500).toISOString();
      TokenManager.setToken('token', futureDate);
      expect(TokenManager.formatTimeUntilExpiry()).toMatch(/45s/);
    });
  });

  describe('periodic interval checks', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('startTokenExpiryCheck should trigger onExpiry callback and clear interval when token expires', () => {
      const pastDate = new Date(Date.now() - 1000).toISOString();
      TokenManager.setToken('expired-token', pastDate);

      const onExpiry = vi.fn();
      const stop = TokenManager.startTokenExpiryCheck(onExpiry, 1000);

      vi.advanceTimersByTime(1000);
      expect(onExpiry).toHaveBeenCalledTimes(1);

      // Should not call again because it cleared itself
      vi.advanceTimersByTime(2000);
      expect(onExpiry).toHaveBeenCalledTimes(1);

      stop();
    });

    it('startTokenRefreshCheck should trigger onRefresh when refresh is needed', () => {
      const nearExpiry = new Date(Date.now() + 60 * 1000).toISOString();
      TokenManager.setToken('token', nearExpiry);

      const onRefresh = vi.fn();
      const stop = TokenManager.startTokenRefreshCheck(onRefresh, 1000);

      vi.advanceTimersByTime(1000);
      expect(onRefresh).toHaveBeenCalledTimes(1);

      stop();
    });
  });
});
