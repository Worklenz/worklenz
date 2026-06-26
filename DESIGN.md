# Worklenz UI Design Instructions

Last updated: 2026-04-23

This file defines the UI design rules for this repository. Use it as the source of truth when creating or modifying UI in:
- `worklenz-frontend`
- `worklenz-client-portal`

## 1. Design Principles

- Build for clarity first: dense product UI is acceptable, confusion is not.
- Preserve consistency with existing Worklenz patterns before introducing new visual language.
- Prefer Ant Design components and design tokens over custom primitives.
- Every UI change must work in both `light` and `dark` themes.
- Every user-facing string must be localized; no hardcoded UI text.

## 2. Theming and Tokens

Use theme tokens from Ant Design `ConfigProvider` and `theme.useToken()`.

Baseline repo tokens currently include:
- `colorPrimary: #1890ff`
- `borderRadius: 6`
- `colorBgLayout`: `#f5f5f5` (light), `#141414` (dark)
- `colorBgContainer`: `#ffffff` (light), `#1f1f1f` (dark)
- `colorText`: `rgba(0,0,0,0.88)` (light), `rgba(255,255,255,0.85)` (dark)
- `colorTextSecondary`: `rgba(0,0,0,0.65)` (light), `rgba(255,255,255,0.65)` (dark)

### Rules
- Do not hardcode one-off hex colors inside components when an existing token can express the same intent.
- For conditional theme values, prefer token-driven variants or centralized helper utilities.
- Keep component radii aligned with the system (`6` for controls, `8` for larger containers/cards/tables).

## 3. Typography

- Primary typeface is Inter/system stack configured in theme.
- Maintain readable hierarchy:
  - Page title: `20-28px`
  - Section title: `16-20px`
  - Body text: `13-15px`
  - Meta/helper text: `12-13px`
- Avoid ultra-light weights for core information.
- Keep line-length practical for data-heavy screens.

## 4. Layout and Spacing

- Use existing layout shells and Ant Design layout primitives (`Layout`, `Row`, `Col`, `Flex`, `Space`).
- Follow an 8px rhythm where practical (`4/8/12/16/24/32`).
- Prefer consistent gutter/padding values within a screen.
- Keep table/filter/action bars sticky only when it solves a real navigation problem.

## 5. Component Rules

### Forms
- Use Ant Design `Form` validation patterns.
- Show validation feedback near the field and keep error copy actionable.
- Required fields must be clearly indicated.

### Tables and Lists
- Optimize for scanning:
  - stable column alignment
  - predictable action locations
  - restrained row hover/focus styles
- Row actions should not jump layout when revealed.
- For large data sets, use pagination or virtualization patterns already present in the repo.

### Buttons and Actions
- One clear primary action per section/modal.
- Avoid multiple high-emphasis buttons in the same action group.
- Destructive actions require confirmation.

### Empty, Loading, Error States
- Every async screen must define all three states.
- Empty states should explain next action.
- Error states should provide recovery action (retry/back/contact).

## 6. Responsive Behavior

- Must support desktop, tablet, and mobile breakpoints.
- On narrower screens:
  - collapse non-critical columns/content
  - keep primary actions reachable
  - avoid horizontal scrolling unless data-table context requires it
- Validate modal/drawer behavior for small screens.

## 7. Accessibility

- Ensure keyboard navigation for interactive controls.
- Preserve visible focus states; do not remove focus outline without replacement.
- Use semantic controls and ARIA attributes when semantics are not implicit.
- Maintain adequate text/background contrast in both themes.
- Icon-only buttons require accessible labels/tooltips.

## 8. Motion and Feedback

- Keep motion subtle and functional (`150-300ms` for most transitions).
- Prefer opacity/transform transitions over expensive layout-affecting animation.
- Use progress indicators for operations above ~300ms.
- Do not animate large surfaces unnecessarily in data-dense workflows.

## 9. Localization Rules (Mandatory)

- No hardcoded user-facing text in JSX/TSX.
- Use i18next for all labels, buttons, placeholders, messages, and headings.
- Always include `defaultValue` in translation calls.
- Use interpolation/pluralization features for dynamic content.

## 10. Implementation Do/Don't

### Do
- Reuse existing components/patterns before introducing new ones.
- Use token-based colors and spacing.
- Test in both themes and at multiple viewport sizes.
- Keep UX consistent between `worklenz-frontend` and `worklenz-client-portal` where behavior overlaps.

### Don't
- Introduce theme-breaking hardcoded colors.
- Add new visual patterns for common controls without a product-level reason.
- Ship UI that only looks correct in one theme.
- Merge features with missing loading/error/empty states.

## 11. PR Checklist for UI Changes

- [ ] Works in light theme
- [ ] Works in dark theme
- [ ] Uses i18n (no hardcoded strings)
- [ ] Uses Ant Design patterns and tokens
- [ ] Keyboard and focus behavior verified
- [ ] Responsive behavior verified
- [ ] Loading, empty, and error states covered
- [ ] No obvious layout shift or performance regressions
