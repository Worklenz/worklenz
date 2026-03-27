# PPM TaskFlow — TODOs

## P3: Portal dark mode + client branding
- **What:** Verify portal supports dark mode. Apply client branding (colors, logo from `ppm_clients.branding_config`) to the portal layout.
- **Why:** Portal may be light-mode only while main app supports dark mode. Branding config exists in DB but may not be applied yet.
- **Context:** Phase 2 CEO review deferred this as cosmetic. Check if it already works before building anything. The `PortalLayout.tsx` and `branding_config` JSONB column are the relevant code paths.
- **Effort:** S (CC: S)
- **Depends on:** Phase 2 complete
- **Added:** 2026-03-26 (CEO review)
