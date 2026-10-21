import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { ConfigProvider } from 'antd';
import AntdApp from 'antd/es/app';
import { clientPortalApi } from '@/store/api';
import authReducer from '@/store/slices/authSlice';
import uiReducer from '@/store/slices/uiSlice';
import { fakeFetch } from './fakeApi/fakeFetch';
import { resetMockState } from './fakeApi/handlers';
import { resetScenario, setScenario, type MockScenario } from './fakeApi/scenario';
import { mockSession } from './fakeApi/session';
import { LocationProbe } from './LocationProbe';
// Registers the /v2 endpoints on the shared API slice.
import '@/store/api-v2';

// Tests run against an in-memory fake of the API (src/test/fakeApi): the pages use their real base query and
// `fetch`, and the fake answers with the same contract and access rules as the backend.
export const enableMock = (): void => {
  vi.stubGlobal('fetch', fakeFetch);
  vi.stubGlobal('open', vi.fn());
};

const i18n = i18next.createInstance();
void i18n.init({ lng: 'en', fallbackLng: false, resources: {}, interpolation: { escapeValue: false }, returnEmptyString: false });

export interface RenderPortalOptions {
  /** Route pattern the page is mounted on, e.g. `/approvals/:id`. */
  path?: string;
  /** The URL to open, e.g. `/approvals/ap123`. */
  route?: string;
  scenario?: Partial<MockScenario>;
}

/** Mounts a page in a fresh store, router and i18n, signed in as the scenario's user (default Alex, Client Admin). */
export const renderPortal = (ui: ReactElement, { path = '/', route = '/', scenario }: RenderPortalOptions = {}) => {
  enableMock();
  resetMockState();
  resetScenario();
  if (scenario) setScenario(scenario);

  // Signed in as the scenario's user, so the layout does not bounce to the sign-in page.
  const initialAuth = authReducer(undefined, { type: '@@init' });
  const session = mockSession();
  const store = configureStore({
    preloadedState: {
      auth: { ...initialAuth, isAuthenticated: true, isLoading: false, token: session.token, user: session.user },
    },
    reducer: {
      [clientPortalApi.reducerPath]: clientPortalApi.reducer,
      auth: authReducer,
      ui: uiReducer,
    },
    middleware: getDefault => getDefault().concat(clientPortalApi.middleware),
  });

  const result = render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <ConfigProvider>
          <AntdApp>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path={path} element={ui} />
              <Route path="*" element={<div data-testid="elsewhere" />} />
            </Routes>
            <LocationProbe />
          </MemoryRouter>
          </AntdApp>
        </ConfigProvider>
      </I18nextProvider>
    </Provider>
  );
  return { ...result, store };
};
