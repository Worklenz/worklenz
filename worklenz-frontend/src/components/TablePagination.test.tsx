import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigProvider, theme } from 'antd';
import TablePagination from './TablePagination';

vi.mock('@/shared/antd-imports', async () => ({
  ...(await import('antd')),
  ...(await import('@ant-design/icons')),
}));
afterEach(cleanup);

for (const [mode, algorithm] of [['light', theme.defaultAlgorithm], ['dark', theme.darkAlgorithm]] as const) {
  describe(`pagination loading state in ${mode} theme`, () => {
    const pagination = (disabled: boolean, onPageChange: (page: number, size: number) => void) => (
      <ConfigProvider theme={{ algorithm }}>
        <TablePagination page={2} pageSize={20} total={150} onPageChange={onPageChange}
          variant="dropdown" disabled={disabled} rowsPerPageLabel="Rows per page"
          navigationLabel="Pagination" firstPageLabel="First" previousPageLabel="Previous"
          nextPageLabel="Next" lastPageLabel="Last" renderDefaultSummary={(range, total) => `${range} of ${total}`} />
      </ConfigProvider>
    );

    it('resets to page one when the user changes the page size', async () => {
      const change = vi.fn();
      render(pagination(false, change));
      fireEvent.click(screen.getByRole('button', { name: 'Rows per page 20' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: '50' }));
      expect(change).toHaveBeenCalledExactlyOnceWith(1, 50);
    });

    it('blocks an already open size menu when loading begins', async () => {
      const change = vi.fn();
      const { rerender } = render(pagination(false, change));
      fireEvent.click(screen.getByRole('button', { name: 'Rows per page 20' }));
      await screen.findByRole('menuitem', { name: '50' });
      rerender(pagination(true, change));
      const option = screen.queryByRole('menuitem', { name: '50' });
      if (option) {
        expect(option).toHaveAttribute('aria-disabled', 'true');
        fireEvent.click(option);
      }
      expect(change).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Rows per page 20' })).toBeDisabled();
    });

    it('disables page navigation during loading', () => {
      const change = vi.fn();
      render(pagination(true, change));
      for (const button of screen.getAllByRole('button')) {
        expect(button).toBeDisabled();
        fireEvent.click(button);
      }
      expect(change).not.toHaveBeenCalled();
    });
  });
}
