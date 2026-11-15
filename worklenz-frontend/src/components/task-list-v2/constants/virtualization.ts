/** Buffer 160px (four ordinary rows); expanded items retain dynamic measurement. */
export const TASK_LIST_VIRTUALIZATION = {
  defaultItemHeight: 40,
  overscan: 160,
  // Retain frame scheduling: immediate measurement produced ResizeObserver
  // loop errors when expanding rows and collapsing groups in the browser test.
  skipAnimationFrameInResizeObserver: false,
};
