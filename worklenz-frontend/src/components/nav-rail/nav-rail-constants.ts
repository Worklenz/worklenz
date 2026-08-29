// Matches Asana's left mode-switcher rail width.
export const NAV_RAIL_EXPANDED_WIDTH = 64;
export const NAV_RAIL_COLLAPSED_WIDTH = 56;

// Shared panel background for every left-rail host (Home, Planner, Reporting,
// Client Portal) and the shared header above them — must stay identical
// across all of them so the header and rail read as one seamless panel
// instead of two adjacent surfaces of slightly different shades.
export const NAV_RAIL_BG_LIGHT = '#ffffff';
export const NAV_RAIL_BG_DARK = '#141414';

// Shared divider color for the border that separates a rail from its content
// pane (rounded top-left corner treatment) on every host — kept distinct from
// antd's own `colorBorderSecondary` token because that token doesn't match
// this exact shade in light mode, which previously made the divider line
// read as a different color depending on which page you were on.
export const NAV_RAIL_DIVIDER_LIGHT = '#e8e8e8';
export const NAV_RAIL_DIVIDER_DARK = '#303030';
