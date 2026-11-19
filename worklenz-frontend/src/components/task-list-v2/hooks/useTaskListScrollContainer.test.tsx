import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { GroupedVirtuoso, VirtuosoMockContext } from 'react-virtuoso';
import { describe, expect, it, vi } from 'vitest';
import { useTaskListScrollContainer } from './useTaskListScrollContainer';
import { TASK_LIST_VIRTUALIZATION } from '../constants/virtualization';

describe('task list scroll container', () => {
  it.each([false, true])('mounts only the external viewport (StrictMode: %s)', async strict => {
    // Observe viewport creation, including transient viewports removed before assertions.
    const viewportModes: string[] = [];
    const listenerSpy = vi.spyOn(HTMLElement.prototype, 'addEventListener');
    const setAttribute = Element.prototype.setAttribute;
    const attributeSpy = vi.spyOn(Element.prototype, 'setAttribute').mockImplementation(function (
      this: Element,
      name: string,
      value: string
    ) {
      if (name === 'data-viewport-type') viewportModes.push(value);
      return setAttribute.call(this, name, value);
    });

    const renderList = (isLoading: boolean) => {
      const list = <ScrollContainerHarness isLoading={isLoading} />;
      return strict ? <StrictMode>{list}</StrictMode> : list;
    };

    try {
      const { rerender } = render(renderList(true));
      expect(viewportModes).toEqual([]);

      rerender(renderList(false));
      await waitFor(() => expect(screen.getByText('Task 0')).toBeInTheDocument());
      const firstParent = screen.getByTestId('scroll-parent');
      expect(firstParent.querySelector('[data-viewport-type="window"]')).not.toBeNull();

      rerender(renderList(true));
      expect(firstParent.isConnected).toBe(false);
      rerender(renderList(false));
      await waitFor(() => expect(screen.getByText('Task 0')).toBeInTheDocument());
      const nextParent = screen.getByTestId('scroll-parent');
      expect(nextParent).not.toBe(firstParent);
      expect(nextParent.querySelector('[data-viewport-type="window"]')).not.toBeNull();
      for (const parent of [firstParent, nextParent]) {
        expect(
          listenerSpy.mock.calls.some(
            (call, index) => call[0] === 'scroll' && listenerSpy.mock.contexts[index] === parent
          )
        ).toBe(true);
      }
      expect(viewportModes.length).toBeGreaterThan(0);
      expect(viewportModes.every(mode => mode === 'window')).toBe(true);
    } finally {
      attributeSpy.mockRestore();
      listenerSpy.mockRestore();
    }
  });
});

const ScrollContainerHarness = ({ isLoading }: { isLoading: boolean }) => {
  const { scrollContainer, attachScrollContainer } = useTaskListScrollContainer();
  if (isLoading) return <section>Loading</section>;

  return (
    <div
      ref={attachScrollContainer}
      data-testid="scroll-parent"
      style={{ height: 300, overflow: 'auto' }}
    >
      <VirtuosoMockContext.Provider value={{ viewportHeight: 300, itemHeight: 40 }}>
        {scrollContainer && (
          <GroupedVirtuoso
            customScrollParent={scrollContainer}
            {...TASK_LIST_VIRTUALIZATION}
            groupCounts={[3]}
            groupContent={() => <div>Group</div>}
            itemContent={index => <div>Task {index}</div>}
          />
        )}
      </VirtuosoMockContext.Provider>
    </div>
  );
};
