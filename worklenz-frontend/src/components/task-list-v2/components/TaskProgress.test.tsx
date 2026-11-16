import { render, screen } from '@testing-library/react';
import { ConfigProvider, theme } from '@/shared/antd-imports';
import { describe, expect, it, vi } from 'vitest';
import TaskProgress from './TaskProgress';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
  }),
}));

describe('task progress ring', () => {
  it.each([theme.defaultAlgorithm, theme.darkAlgorithm])(
    'uses theme tokens and preserves percentage updates',
    algorithm => {
      const tokens = theme.getDesignToken({ algorithm });
      const ring = (progress: number) => (
        <ConfigProvider theme={{ algorithm }}>
          <TaskProgress progress={progress} numberOfSubTasks={2} />
        </ConfigProvider>
      );
      const { rerender } = render(ring(25));
      const progress = screen.getByRole('progressbar', { name: 'Progress' });
      expect(progress).toHaveAttribute('aria-valuenow', '25');
      expect(progress).toHaveTextContent('25%');
      const circles = progress.querySelectorAll('circle');
      expect(circles[0]).toHaveAttribute('stroke', tokens.colorFillSecondary);
      expect(circles[1]).toHaveAttribute('stroke', tokens.colorInfo);
      expect(circles[1]).toHaveAttribute('stroke-dashoffset', '75');
      expect(progress.querySelector('text')).toHaveAttribute('fill', tokens.colorText);
      rerender(ring(100));
      expect(progress).toHaveAttribute('aria-valuenow', '100');
      expect(progress.querySelector('path')).toHaveAttribute('stroke', tokens.colorSuccess);
    }
  );

  it.each([-10, Number.NaN, Number.POSITIVE_INFINITY])(
    'handles invalid or out-of-range values: %s',
    value => {
      render(<TaskProgress progress={value} numberOfSubTasks={0} />);
      const progress = screen.getByRole('progressbar');
      expect(progress).toHaveAttribute('aria-valuenow', '0');
      expect(progress.querySelectorAll('circle')[1]).toHaveAttribute('opacity', '0');
    }
  );
});
