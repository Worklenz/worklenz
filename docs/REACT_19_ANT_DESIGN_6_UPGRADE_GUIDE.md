# React 19 & Ant Design 6 Upgrade Guide

## Overview
Two-phase upgrade strategy for **worklenz-frontend** only (client portal already on React 19):
- **Phase 1**: Upgrade to React 19 (low risk, ~2-3 hours)
- **Phase 2**: Upgrade to Ant Design 6 (higher effort, ~2-3 days)

## Current State
```json
"react": "^18.3.1"           → Target: "^19.2.3"
"react-dom": "^18.3.1"       → Target: "^19.2.3"
"antd": "^5.26.2"            → Target: "^6.1.0"
"@ant-design/icons": "^4.7.0" → Target: "^6.0.0"
```

**Note**: React 19 types already installed (@types/react: 19.0.0)

## Performance Benefits of Upgrading to Ant Design 6

### 1. **Reduced Bundle Size**
- CSS Variables mode by default (no IE support overhead)
- Multi-theme CSS reuse reduces duplicate styles
- Removed legacy React compatibility code
- **Expected**: 10-20% smaller bundle size

### 2. **Faster Loading Times**
- Pure CSS Variables are lighter than runtime CSS-in-JS
- Less JavaScript to parse and execute
- Better tree-shaking with removed IE code
- **Expected**: Faster initial page load

### 3. **Better Runtime Performance**
- React Compiler integration for optimized component rendering
- React 19 concurrent features work better
- Reduced style injection overhead
- **Expected**: Smoother interactions, faster re-renders

### 4. **Faster Theme Switching**
- CSS Variables switch instantly (no runtime style recalculation)
- Your dark/light theme toggle will be noticeably faster
- **Expected**: Near-instant theme changes

**Sources**:
- [Ant Design 6.0 Release](https://github.com/ant-design/ant-design/issues/55804)
- [Ant Design 6.0 Announcement](https://dev.to/zombiej/ant-design-60-is-released-bfa)
- [Bundle Size Optimization](https://ant.design/docs/blog/tree-shaking/)
- [CSS-in-JS Performance](https://ant.design/docs/blog/css-in-js/)

---

## PHASE 1: React 19 Upgrade

### 1. Update package.json Dependencies
```json
{
  "react": "^19.2.3",
  "react-dom": "^19.2.3",
  "@ant-design/icons": "^6.0.0",
  "@ant-design/v5-patch-for-react-19": "^1.0.3"  // NEW - Required!
}
```

### 2. Install Dependencies
```bash
cd worklenz-frontend
rm -rf node_modules package-lock.json
npm install
```

### 3. Add React 19 Compatibility Patch

**File**: `worklenz-frontend/src/index.tsx`

Add at **line 1** (before all other imports):
```typescript
import '@ant-design/v5-patch-for-react-19';
```

### 4. Update Icon Imports (if needed)

Check for deprecated v4-specific imports:
```bash
grep -r "from '@ant-design/icons/lib" worklenz-frontend/src/
```

Replace with standard imports:
```typescript
// Before: import { Icon } from '@ant-design/icons/lib/icons/Icon';
// After:  import { Icon } from '@ant-design/icons';
```

### 5. Testing Checklist

**Build & Tests:**
```bash
npm run build          # Must succeed
npm run test           # All tests pass
npm run dev           # Start dev server
```

**Manual Testing:**
- [ ] Login/signup flow works
- [ ] Theme switching (dark/light) works
- [ ] Navigation functional
- [ ] Forms submit correctly
- [ ] Tables render and paginate
- [ ] Modals/drawers open/close
- [ ] No console errors

### 6. Rollback Plan
```bash
git checkout HEAD -- package.json
rm -rf node_modules package-lock.json
npm install
```

---

## PHASE 2: Ant Design 6 Upgrade

**Prerequisites**: Phase 1 stable and tested

### Breaking Changes in Ant Design 6

#### 1. **Component API Changes**
- `Button`: `iconPosition` → `iconPlacement`
- `Space`: `direction` → `orientation`
- `Drawer`: `width`/`height` → `size`, consolidated styles
- `Select`, `AutoComplete`, `DatePicker`, `Cascader`: `dropdown*` → `popup*` props
- `Tag`: Removed default trailing margin
- `Form.List`: No longer includes unregistered child fields in `onFinish`

#### 2. **Deprecated Components** (warnings in v6, removed in v7)
- `Button.Group` → `Space.Compact`
- `Dropdown.Button` → `Space.Compact` + `Dropdown` + `Button`
- `Input.Group` → `Space.Compact`
- `Tabs.TabPane` → `items` prop
- `Breadcrumb.Item` → `items` prop
- `BackTop` → `FloatButton.BackTop`

#### 3. **DOM Structure Changes**
- Internal component structures refactored
- Custom CSS selectors may need updates

#### 4. **New Features**
- Mask blur effects on Modal/Drawer (enabled by default)
- Semantic structure support via ConfigProvider

### 1. Update package.json Dependencies
```json
{
  "antd": "^6.1.0",  // Latest stable version as of 2025-12
  "@ant-design/icons": "^6.0.0",  // Already updated in Phase 1
  "@ant-design/compatible": "^6.0.0",  // If needed
  "@ant-design/pro-components": "^3.0.0"  // Verify compatibility
}

// Remove:
// "@ant-design/v5-patch-for-react-19": DELETE
```

### 2. Install Dependencies
```bash
cd worklenz-frontend
rm -rf node_modules package-lock.json
npm install
```

### 3. Check for Additional Breaking Changes

Before making bulk changes, search for these patterns:

```bash
# Check for deprecated props
grep -r "iconPosition" worklenz-frontend/src/
grep -r "direction=" worklenz-frontend/src/ | grep "Space"
grep -r "dropdownStyle\|dropdownClassName" worklenz-frontend/src/
grep -r "Drawer.*width\|Drawer.*height" worklenz-frontend/src/
```

### 4. Code Changes (4 Priority Levels)

#### Priority 1: Fix Import Paths (25 files)
**Pattern**: Replace `antd/lib` with `antd/es` or use centralized imports

**Automated fix**:
```bash
find worklenz-frontend/src -type f \( -name "*.tsx" -o -name "*.ts" \) \
  -exec sed -i 's|from "antd/lib|from "antd/es|g' {} \;
```

**Better approach**: Use centralized imports from `@/shared/antd-imports`

**Example files**:
- `src/pages/client-portal/requests/requests-table.tsx`
- `src/pages/client-portal/services/ServicesTable.tsx`
- `src/pages/client-portal/invoices/invoices-table.tsx`
- (22 more files)

#### Priority 2: Update Size Props (242 files)
**Pattern**: Change size values `small/middle/large` → `sm/md/lg`

**Automated fix**:
```bash
find worklenz-frontend/src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i \
  -e 's/size="small"/size="sm"/g' \
  -e 's/size="middle"/size="md"/g' \
  -e 's/size="large"/size="lg"/g' \
  -e "s/size='small'/size='sm'/g" \
  -e "s/size='middle'/size='md'/g" \
  -e "s/size='large'/size='lg'/g" \
  {} +
```

**Update config file**: `src/shared/antd-imports.ts` (lines 331-393)
```typescript
// Change all instances of:
size: 'small' as const  →  size: 'sm' as const
size: 'middle' as const →  size: 'md' as const
size: 'large' as const  →  size: 'lg' as const
```

#### Priority 3: Replace Button.Group (4 files)
**Files**:
- `src/components/admin-center/billing/drawers/upgrade-plans/components/PlanSelectionControls.tsx`
- `src/components/admin-center/billing/drawers/upgrade-plans/upgrade-plans-backup.tsx`
- `src/components/admin-center/billing/drawers/upgrade-plans/upgrade-plans-original.tsx`
- `src/components/PreferenceSelector.tsx`

**Migration options**:
```typescript
// Option A: Use Space.Compact
<Space.Compact>
  <Button>Option 1</Button>
  <Button>Option 2</Button>
</Space.Compact>

// Option B: Use Segmented (better UX)
<Segmented
  options={['Option 1', 'Option 2']}
  onChange={handleChange}
/>
```

**Action**: Manual review each usage for context-appropriate replacement

#### Priority 4: Update Form Layouts (14 files)
**Pattern**: Remove deprecated `labelCol` and `wrapperCol` props

**Before**:
```typescript
<Form labelCol={{ span: 8 }} wrapperCol={{ span: 16 }}>
```

**After** (Option A - Layout prop):
```typescript
<Form layout="horizontal" labelWidth={120}>
```

**After** (Option B - CSS):
```typescript
<Form className="custom-form-layout">

// Add CSS:
.custom-form-layout .ant-form-item {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 8px;
}
```

**Example files**:
- `src/pages/settings/labels/labels-settings.tsx`
- `src/components/task-drawer/shared/info-tab/task-details-form.tsx`
- (12 more files)

### 4. Update CSS Overrides

**File**: `src/styles/customOverrides.css` (229 lines)

**Strategy**: Incremental testing
1. Backup original file
2. Research Ant Design v6 class name changes
3. Update CSS selectors section by section
4. Test visual appearance after each section

**Common changes**:
```css
/* v5 uses hash-based classes */
:where(.css-dev-only-do-not-override-17sis5b).ant-table-wrapper

/* v6 may have different class names - check changelog */
```

**Backup command**:
```bash
cp src/styles/customOverrides.css src/styles/customOverrides.css.v5.backup
```

### 5. Update Theme Configuration

**Files**:
- `src/index.tsx` (lines 30-42)
- `src/features/theme/ThemeWrapper.tsx`

**Action**: Verify token API compatibility with v6
```typescript
<ConfigProvider
  theme={{
    algorithm: theme.darkAlgorithm,
    components: {
      Layout: { colorBgLayout: ... },
      Spin: { colorPrimary: ... }
    }
  }}
>
```

Check if token names changed in v6 documentation.

### 6. Remove Compatibility Patch

**File**: `src/index.tsx`

Remove line added in Phase 1:
```typescript
import '@ant-design/v5-patch-for-react-19';  // DELETE THIS
```

### 7. Testing Strategy

**Level 1: Build**
```bash
npx tsc --noEmit  # Type check
npm run build     # Build check
```

**Level 2: Automated Tests**
```bash
npm run test
npm run test:coverage
```

**Level 3: Visual Regression (Both Themes)**

Test all pages in light and dark mode:
- [ ] Auth pages (login, signup)
- [ ] Dashboard/home
- [ ] Projects (list, board, Gantt)
- [ ] Tasks (list, drawer)
- [ ] Settings (all tabs)
- [ ] Reports
- [ ] Client portal pages
- [ ] All button sizes correct
- [ ] All forms functional
- [ ] All tables display properly
- [ ] All modals/drawers work

**Level 4: Performance**
```bash
npm run build
ls -lh dist/assets/  # Check bundle size
# Run Lighthouse audit
```

### 8. Rollback Plan

**To Phase 1 (React 19 + Ant Design 5)**:
```bash
git checkout HEAD~1 -- package.json src/
npm install
```

**To React 18**:
```bash
git checkout main -- package.json src/
npm install
```

---

## Critical Files Summary

### Phase 1 (3 files):
1. `worklenz-frontend/package.json` - Dependency updates
2. `worklenz-frontend/src/index.tsx` - Add compatibility patch
3. `worklenz-frontend/src/features/theme/ThemeWrapper.tsx` - Verify compatibility

### Phase 2 (Key files):
1. `worklenz-frontend/package.json` - Ant Design v6 update
2. `worklenz-frontend/src/shared/antd-imports.ts` - Update size configs
3. `worklenz-frontend/src/styles/customOverrides.css` - Update CSS selectors
4. `worklenz-frontend/src/components/admin-center/billing/drawers/upgrade-plans/components/PlanSelectionControls.tsx` - Button.Group replacement
5. 25 files with `antd/lib` imports
6. 242 files with size props
7. 14 files with form layout props

---

## Timeline Estimate

- **Phase 1**: 2-3 hours (same day)
- **Phase 2**: 2-3 days
  - Day 1: Dependencies + automated fixes (imports, size props)
  - Day 2: Manual fixes (Button.Group, form layouts) + CSS updates
  - Day 3: Comprehensive testing + bug fixes

---

## Success Criteria

**Phase 1**:
- ✓ Build completes without errors
- ✓ All tests pass
- ✓ No React console warnings
- ✓ Theme switching works
- ✓ All critical flows functional

**Phase 2**:
- ✓ TypeScript compiles
- ✓ Build succeeds
- ✓ All tests pass (or updated)
- ✓ Visual appearance unchanged
- ✓ No console errors
- ✓ Performance metrics acceptable
- ✓ Bundle size reasonable

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking CSS changes | High | Incremental updates with testing |
| Size prop layout breaks | Medium | Visual test all pages |
| Button.Group replacements | Medium | Manual review each usage |
| Form layouts break | Medium | Test all forms after changes |
| Pro Components incompatible | Medium | Verify compatibility before upgrading |

---

## Post-Upgrade

- [ ] Update README with new versions
- [ ] Document any workarounds
- [ ] Create team migration guide
- [ ] Remove backup files
- [ ] Update CI/CD if needed

---

## Additional Resources

- [React 19 Upgrade Guide](https://react.dev/blog/2024/12/05/react-19)
- [Ant Design 6.0 Migration Guide](https://ant.design/docs/react/migration-v6)
- [Ant Design 6.0 Changelog](https://ant.design/changelog)
- Client Portal Reference: `worklenz-client-portal/` (already on React 19)
