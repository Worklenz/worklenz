import { useMemo } from 'react';

interface Label {
  id: string;
  name: string;
  color?: string;
  color_code?: string;
}

interface LabelsOverflowResult {
  visibleLabels: Label[];
  hiddenLabels: Label[];
  overflowCount: number;
}

/**
 * Calculate which labels fit in the available width and which overflow
 * Optimized for smooth resize performance
 * 
 * @param labels - Array of label objects
 * @param columnWidth - Available width in pixels
 * @returns Object with visible labels, hidden labels, and overflow count
 */
export const useLabelsOverflow = (
  labels: Label[] | undefined,
  columnWidth: number
): LabelsOverflowResult => {
  return useMemo(() => {
    if (!labels || labels.length === 0) {
      return {
        visibleLabels: [],
        hiddenLabels: [],
        overflowCount: 0,
      };
    }

    // Constants for chip sizing (matching Asana-style compact chips)
    const CHIP_PADDING = 16; // 8px left + 8px right padding
    const CHIP_GAP = 4; // 4px gap between chips
    const CHAR_WIDTH = 7; // Average character width in pixels
    const OVERFLOW_BADGE_WIDTH = 40; // Width for "+N" badge (e.g., "+99")
    const SELECTOR_BUTTON_WIDTH = 32; // Width for the LabelsSelector button
    const CONTAINER_PADDING = 8; // Reduced from 16px - only 4px left + 4px right

    // Calculate available width for chips (excluding container padding and selector button)
    const availableWidth = columnWidth - CONTAINER_PADDING - SELECTOR_BUTTON_WIDTH - CHIP_GAP;

    if (availableWidth <= 0) {
      // Column too narrow - show compact badge
      return {
        visibleLabels: [],
        hiddenLabels: labels,
        overflowCount: labels.length,
      };
    }

    /**
     * Calculate the pixel width a chip would occupy
     * Uses max-width with ellipsis, so short names don't waste space
     */
    const calculateChipWidth = (label: Label): number => {
      const textWidth = label.name.length * CHAR_WIDTH;
      const chipWidth = textWidth + CHIP_PADDING;
      // Cap at reasonable max-width to prevent very long labels from consuming too much space
      return Math.min(chipWidth, 120);
    };

    const visibleLabels: Label[] = [];
    const hiddenLabels: Label[] = [];
    let accumulatedWidth = 0;

    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const chipWidth = calculateChipWidth(label);

      // Check if we need to reserve space for overflow badge
      const remainingLabels = labels.length - i;
      const needsOverflowBadge = remainingLabels > 1;
      const requiredSpace = needsOverflowBadge
        ? chipWidth + CHIP_GAP + OVERFLOW_BADGE_WIDTH
        : chipWidth;

      if (accumulatedWidth + requiredSpace <= availableWidth) {
        // This chip fits
        visibleLabels.push(label);
        accumulatedWidth += chipWidth + CHIP_GAP;
      } else {
        // This chip doesn't fit - add all remaining labels to hidden
        hiddenLabels.push(...labels.slice(i));
        break;
      }
    }

    return {
      visibleLabels,
      hiddenLabels,
      overflowCount: hiddenLabels.length,
    };
  }, [labels, columnWidth]);
};
