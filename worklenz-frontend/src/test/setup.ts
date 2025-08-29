import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
Object.defineProperty(process, 'env', {
  value: {
    NODE_ENV: 'test',
    VITE_API_URL: 'http://localhost:3000',
    VITE_ENABLE_GOOGLE_LOGIN: 'true',
    VITE_ENABLE_RECAPTCHA: 'false',
    VITE_RECAPTCHA_SITE_KEY: 'test-site-key',
  },
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock window.getSelection
Object.defineProperty(window, 'getSelection', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    rangeCount: 0,
    getRangeAt: vi.fn(),
    removeAllRanges: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
vi.stubGlobal('localStorage', localStorageMock);

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
vi.stubGlobal('sessionStorage', sessionStorageMock);

// Suppress console warnings during tests
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  // Suppress specific warnings that are not relevant for tests
  if (
    args[0]?.includes?.('React Router Future Flag Warning') ||
    args[0]?.includes?.('validateDOMNesting')
  ) {
    return;
  }
  originalConsoleWarn(...args);
};
