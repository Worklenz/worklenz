import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import GreetingWithTime from './GreetingWithTime';

vi.mock('@/utils/session-helper', () => ({ getUserSession: () => ({ name: 'Alex Chen' }) }));
vi.mock('@/utils/language-utils', () => ({ getLanguageFromLocalStorage: () => 'zh_tw' }));
vi.mock('@/hooks/useAppSelector', () => ({ useAppSelector: () => 'light' }));
vi.mock('@/shared/antd-imports', () => ({ theme: { useToken: () => ({ token: {} }) } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, options: { defaultValue: string }) => options.defaultValue }),
}));

describe('Taiwan home greeting', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it.each([[9, '早安'], [14, '午安'], [19, '晚安']])(
    'renders the current home greeting at hour %s',
    (hour, greeting) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 4, 18, Number(hour)));

      render(<GreetingWithTime />);

      expect(screen.getByText(`${greeting}, Alex`)).toBeInTheDocument();
      expect(screen.getByText(/星期一/)).toBeInTheDocument();
    }
  );
});
