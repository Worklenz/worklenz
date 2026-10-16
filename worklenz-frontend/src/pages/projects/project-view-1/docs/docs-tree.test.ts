import { describe, expect, it } from 'vitest';
import { IProjectDocumentSummary } from '@/types/project/project-documents.types';
import { dragPlacement, planDocumentMove } from './docs-tree';

const page = (id: string, position: number): IProjectDocumentSummary =>
  ({ id, title: id, parent_id: null, position }) as IProjectDocumentSummary;
const pages = [page('a', 0), page('b', 1), page('c', 2), page('d', 3)];
const order = (items: ReturnType<typeof planDocumentMove>) =>
  [...items!].sort((x, y) => x.position - y.position).map(item => item.id).join('');

describe('page drag placement', () => {
  it('chooses before when dragging up, after when dragging down, inside when dragging right', () => {
    expect(dragPlacement(3, 1, 0)).toBe('before');
    expect(dragPlacement(1, 3, 0)).toBe('after');
    expect(dragPlacement(2, 1, 40)).toBe('inside');
  });

  it('moves a page up by one row', () => {
    expect(order(planDocumentMove(pages, 'c', 'b', dragPlacement(2, 1, 0)))).toBe('acbd');
  });

  it('moves a page up by several rows and down by one row', () => {
    expect(order(planDocumentMove(pages, 'd', 'b', dragPlacement(3, 1, 0)))).toBe('adbc');
    expect(order(planDocumentMove(pages, 'b', 'c', dragPlacement(1, 2, 0)))).toBe('acbd');
  });
});
