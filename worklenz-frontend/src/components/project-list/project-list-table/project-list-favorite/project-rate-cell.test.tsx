import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { createInstance } from 'i18next';
import { ConfigProvider, theme } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import translations from '../../../../../public/locales/en/all-project-list.json';
import { ProjectRateCell } from './project-rate-cell';

const { toggleFavoriteProject, unwrap } = vi.hoisted(() => ({
  toggleFavoriteProject: vi.fn(),
  unwrap: vi.fn(),
}));

vi.mock('@/api/projects/projects.v1.api.service', () => ({
  useToggleFavoriteProjectMutation: () => [toggleFavoriteProject],
}));

afterEach(cleanup);

beforeEach(() => {
  toggleFavoriteProject.mockReset().mockReturnValue({ unwrap });
  unwrap.mockReset().mockResolvedValue(undefined);
});

const renderFavorite = async (isFavorite: boolean, isDark = false) => {
  const missingKeyHandler = vi.fn();
  const instance = createInstance();
  await instance.init({
    lng: 'en',
    fallbackLng: false,
    defaultNS: 'all-project-list',
    resources: { en: { 'all-project-list': translations } },
    saveMissing: true,
    missingKeyHandler,
  });
  render(
    <ConfigProvider theme={{ algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
      <ProjectRateCell record={{ id: 'project-id', favorite: isFavorite }} t={instance.t} />
    </ConfigProvider>
  );
  return { missingKeyHandler };
};

describe('ProjectRateCell favorite translations', () => {
  it.each([false, true])('shows both translated actions without missing keys (dark: %s)', async isDark => {
    const { missingKeyHandler } = await renderFavorite(false, isDark);
    const button = screen.getByRole('button', { name: 'Add to favourites' });
    fireEvent.mouseEnter(button);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Add to favourites');

    fireEvent.click(button);
    await waitFor(() => expect(toggleFavoriteProject).toHaveBeenCalledWith('project-id'));
    expect(screen.getByRole('button', { name: 'Remove from favourites' })).toBeInTheDocument();
    expect(missingKeyHandler).not.toHaveBeenCalled();
  });

  it('restores the translated remove action when removing a favorite fails', async () => {
    unwrap.mockRejectedValueOnce(new Error('Failed to save favorite'));
    const { missingKeyHandler } = await renderFavorite(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove from favourites' }));
    await waitFor(() => expect(unwrap).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove from favourites' })).toBeInTheDocument());
    expect(missingKeyHandler).not.toHaveBeenCalled();
  });
});
