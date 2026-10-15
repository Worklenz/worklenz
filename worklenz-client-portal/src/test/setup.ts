import '@testing-library/jest-dom/vitest';
import '@ant-design/v5-patch-for-react-19';
import { vi } from 'vitest';

// Mock window.matchMedia (immune to vi.restoreAllMocks)
const createMatchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string) => createMatchMedia(query),
});

// Mock in-memory localStorage and sessionStorage
const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

const localStorageMock = createStorageMock();
Object.defineProperty(window, 'localStorage', {
  writable: true,
  configurable: true,
  value: localStorageMock,
});

const sessionStorageMock = createStorageMock();
Object.defineProperty(window, 'sessionStorage', {
  writable: true,
  configurable: true,
  value: sessionStorageMock,
});

// jsdom has no ResizeObserver (react-grid-layout and recharts both measure their container).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', { writable: true, configurable: true, value: ResizeObserverStub });
}

// ProseMirror needs a real layout engine, so tests type into a textarea stand-in for the rich-text editor.
vi.mock('@/components/v2/RichTextEditor', async () => {
  const { RichTextEditorStub } = await import('./richTextEditorStub');
  return { RichTextEditor: RichTextEditorStub };
});
