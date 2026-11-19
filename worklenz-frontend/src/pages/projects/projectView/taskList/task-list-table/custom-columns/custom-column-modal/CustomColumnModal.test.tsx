import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import type { ModalProps } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import reducer, {
  toggleCustomColumnModalOpen,
} from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import CustomColumnModal from './CustomColumnModal';

const mocks = vi.hoisted(() => ({ modalRender: vi.fn() }));
vi.mock('@/shared/antd-imports', async () => {
  const { Modal } = await import('antd');
  return {
    Modal: (props: ModalProps) => {
      mocks.modalRender();
      return <Modal {...props} />;
    },
  };
});
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: { defaultValue: string }) => options.defaultValue,
  }),
}));
vi.mock('./CustomColumnFormContent', () => ({
  default: ({ projectId, onDone }: { projectId: string; onDone: () => void }) => (
    <button onClick={onDone}>Save column for {projectId}</button>
  ),
}));

const createTestStore = () =>
  configureStore({ reducer: { taskListCustomColumnsReducer: reducer } });

for (const [mode, algorithm] of [
  ['light', theme.defaultAlgorithm],
  ['dark', theme.darkAlgorithm],
] as const) {
  describe(`custom-column modal in ${mode} theme`, () => {
    beforeEach(() => mocks.modalRender.mockClear());

    it('defers closed dialog setup and opens exactly one dialog when several hosts exist', async () => {
      const store = createTestStore();
      render(
        <Provider store={store}>
          <MemoryRouter>
            <ConfigProvider theme={{ algorithm }}>
              <CustomColumnModal projectId="project-1" />
              <CustomColumnModal projectId="project-1" />
            </ConfigProvider>
          </MemoryRouter>
        </Provider>
      );
      expect(mocks.modalRender).not.toHaveBeenCalled();
      act(() => {
        store.dispatch(toggleCustomColumnModalOpen(true));
      });
      expect(await screen.findAllByRole('dialog')).toHaveLength(1);
      fireEvent.click(screen.getByRole('button', { name: 'Save column for project-1' }));
      expect(store.getState().taskListCustomColumnsReducer.isCustomColumnModalOpen).toBe(false);
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      act(() => {
        store.dispatch(toggleCustomColumnModalOpen(true));
      });
      expect(await screen.findAllByRole('dialog')).toHaveLength(1);
    });

    it('hands dialog ownership to the remaining host when the first unmounts', async () => {
      const store = createTestStore();
      const view = (showFirst: boolean) => (
        <Provider store={store}>
          <MemoryRouter>
            <ConfigProvider theme={{ algorithm }}>
              {showFirst && <CustomColumnModal key="first" projectId="project-1" />}
              <CustomColumnModal key="second" projectId="project-2" />
            </ConfigProvider>
          </MemoryRouter>
        </Provider>
      );
      const { rerender } = render(view(true));
      act(() => {
        store.dispatch(toggleCustomColumnModalOpen(true));
      });
      expect(
        await screen.findByRole('button', { name: 'Save column for project-1' })
      ).toBeInTheDocument();
      rerender(view(false));
      expect(
        await screen.findByRole('button', { name: 'Save column for project-2' })
      ).toBeInTheDocument();
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
    });
  });
}
