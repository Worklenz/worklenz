import { useState, useCallback, useEffect, useRef } from 'react';

const MIN_WIDTH = 180;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 444;
const STORAGE_KEY_PREFIX = 'gantt-left-panel-width';

interface UseResizablePanelOptions {
  projectId: string;
}

export const useResizablePanel = ({ projectId }: UseResizablePanelOptions) => {
  // Initialize with saved width or default
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const storageKey = `${STORAGE_KEY_PREFIX}-${projectId}`;
    const savedWidth = localStorage.getItem(storageKey);
    
    if (savedWidth) {
      const width = parseInt(savedWidth, 10);
      // Validate saved width is within bounds
      if (width >= MIN_WIDTH && width <= MAX_WIDTH) {
        return width;
      }
    }
    return DEFAULT_WIDTH;
  });

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  // Width the panel was at when the current drag started — captured once in
  // handleMouseDown and left untouched for the rest of that drag, so every mousemove
  // computes width purely from total displacement since drag start (dragStartWidthRef +
  // deltaX-from-startXRef). currentWidthRef instead mirrors the live panelWidth state, so
  // using it as the base here would double-count: each mousemove's deltaX is already
  // measured from the fixed drag-start point, so adding it to a width that already
  // includes previous moves' deltas made the panel resize far faster than the mouse
  // actually moved and drift the divider away from the cursor.
  const currentWidthRef = useRef(panelWidth);
  const dragStartWidthRef = useRef(panelWidth);

  // Keep current width ref in sync with state
  useEffect(() => {
    currentWidthRef.current = panelWidth;
  }, [panelWidth]);

  // Handle mouse down on drag handle
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    setIsDragging(true);
    startXRef.current = e.clientX;
    dragStartWidthRef.current = currentWidthRef.current;

    // Apply visual feedback
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  // Handle mouse move during drag
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;

    const deltaX = e.clientX - startXRef.current;
    const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dragStartWidthRef.current + deltaX));

    setPanelWidth(newWidth);
  }, []);

  // Handle mouse up to end drag
  const handleMouseUp = useCallback(() => {
    if (!isDraggingRef.current) return;

    isDraggingRef.current = false;
    setIsDragging(false);

    // Reset visual feedback
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
    
    // Save width to localStorage
    const storageKey = `${STORAGE_KEY_PREFIX}-${projectId}`;
    localStorage.setItem(storageKey, currentWidthRef.current.toString());
  }, [projectId]);

  // Add mouse move and mouse up listeners - IMPORTANT: No dependencies except projectId
  // This prevents re-attaching listeners on every width change during drag
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove, false);
    document.addEventListener('mouseup', handleMouseUp, false);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, false);
      document.removeEventListener('mouseup', handleMouseUp, false);
    };
  }, [handleMouseMove, handleMouseUp]);

  return {
    panelWidth,
    handleMouseDown,
    isDragging,
    MIN_WIDTH,
    MAX_WIDTH,
    DEFAULT_WIDTH,
  };
};
