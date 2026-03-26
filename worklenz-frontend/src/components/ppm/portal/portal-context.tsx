import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { portalApi, IPortalUser, IBranding } from './portal-api';

interface IPortalContext {
  user: IPortalUser | null;
  branding: IBranding | null;
  loading: boolean;
  login: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const PortalContext = createContext<IPortalContext>({
  user: null,
  branding: null,
  loading: true,
  login: async () => false,
  logout: async () => {},
  refresh: async () => {},
});

export const usePortal = () => useContext(PortalContext);

export const PortalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<IPortalUser | null>(null);
  const [branding, setBranding] = useState<IBranding | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      const res = await portalApi.getMe();
      if (res.done && res.body) {
        setUser(res.body);
        const brandRes = await portalApi.getBranding();
        if (brandRes.done && brandRes.body) setBranding(brandRes.body);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const login = useCallback(async (token: string) => {
    try {
      const res = await portalApi.validateMagicLink(token);
      if (res.done && res.body) {
        setUser(res.body);
        const brandRes = await portalApi.getBranding();
        if (brandRes.done && brandRes.body) setBranding(brandRes.body);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await portalApi.logout();
    } catch { /* ignore */ }
    setUser(null);
    setBranding(null);
  }, []);

  return (
    <PortalContext.Provider value={{ user, branding, loading, login, logout, refresh: fetchSession }}>
      {children}
    </PortalContext.Provider>
  );
};
