import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DocsBreadcrumbs, documentAncestors } from './docs-page-navigation';
import { IProjectDocumentSummary } from '@/types/project/project-documents.types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: { defaultValue: string }) => options.defaultValue,
  }),
}));
afterEach(cleanup);
const page = (id: string, parent_id: string | null): IProjectDocumentSummary => ({
  id,
  parent_id,
  project_id: 'project',
  title: id,
  position: 0,
  updated_at: '',
  updated_by_name: null,
});
it('follows the hierarchy in root-first order and navigates ancestors without treating the current draft title as a link', () => {
  const pages = [page('child', 'parent'), page('root', null), page('parent', 'root')];
  const onSelect = vi.fn();
  render(
    <DocsBreadcrumbs pages={pages} documentId="child" title="Unsaved title" onSelect={onSelect} />
  );
  expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual([
    'root',
    'parent',
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'parent' }));
  expect(onSelect).toHaveBeenCalledWith('parent');
  expect(screen.getByText('Unsaved title')).toHaveAttribute('aria-current', 'page');
});
it('tolerates missing parents and malformed cycles', () => {
  expect(documentAncestors([page('child', 'missing')], 'child')).toEqual([]);
  expect(
    documentAncestors([page('child', 'parent'), page('parent', 'child')], 'child').map(
      item => item.id
    )
  ).toEqual(['parent']);
});
