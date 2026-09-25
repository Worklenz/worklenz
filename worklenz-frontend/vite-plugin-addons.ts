import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

function resolveAddonFile(basePath: string): string | null {
  const exts = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
  for (const ext of exts) {
    const full = basePath + ext;
    if (fs.existsSync(full) && !fs.statSync(full).isDirectory()) {
      return full;
    }
  }
  return null;
}

function getEnabledAddonIds(env?: Record<string, string>): string[] {
  const rawAddons =
    env?.ENABLED_ADDONS ||
    env?.VITE_ENABLED_ADDONS ||
    process.env.ENABLED_ADDONS ||
    process.env.VITE_ENABLED_ADDONS ||
    '';
  return Array.from(
    new Set(
      rawAddons
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

export function addonsPlugin(env?: Record<string, string>): Plugin {
  const virtualModuleId = 'virtual:addons-registry';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;

  return {
    name: 'vite-plugin-addons',
    enforce: 'pre',
    transformIndexHtml(html) {
      const enabledAddonIds = getEnabledAddonIds(env);
      let appTitle = env?.VITE_APP_TITLE || process.env.VITE_APP_TITLE;
      let faviconUrl = env?.VITE_FAVICON_URL || process.env.VITE_FAVICON_URL;

      if (!appTitle || !faviconUrl) {
        for (const addonId of enabledAddonIds) {
          const manifestCandidates = [
            path.resolve(process.cwd(), '../addons', addonId, 'manifest.json'),
            path.resolve(process.cwd(), 'addons', addonId, 'manifest.json'),
            path.resolve(__dirname, '../addons', addonId, 'manifest.json'),
          ];
          for (const cand of manifestCandidates) {
            if (fs.existsSync(cand)) {
              try {
                const manifest = JSON.parse(fs.readFileSync(cand, 'utf-8'));
                if (!appTitle && manifest.branding?.title) {
                  appTitle = manifest.branding.title;
                }
                if (!faviconUrl && manifest.branding?.favicon) {
                  faviconUrl = manifest.branding.favicon;
                }
              } catch {}
              break;
            }
          }
        }
      }

      let transformed = html;
      if (appTitle) {
        transformed = transformed.replace(/<title>.*?<\/title>/gi, `<title>${appTitle}</title>`);
        transformed = transformed.replace(/<meta name="apple-mobile-web-app-title" content=".*?" \/>/gi, `<meta name="apple-mobile-web-app-title" content="${appTitle}" />`);
        transformed = transformed.replace(/<meta name="application-name" content=".*?" \/>/gi, `<meta name="application-name" content="${appTitle}" />`);
      }
      if (faviconUrl) {
        transformed = transformed.replace(/<link rel="icon" href=".*?" \/>/gi, `<link rel="icon" href="${faviconUrl}" />`);
        transformed = transformed.replace(/<link rel="apple-touch-icon" href=".*?" \/>/gi, `<link rel="apple-touch-icon" href="${faviconUrl}" />`);
        transformed = transformed.replace(/<link rel="apple-touch-icon" sizes=".*?" href=".*?" \/>/gi, (m) => m.replace(/href=".*?"/, `href="${faviconUrl}"`));
      }
      return transformed;
    },
    async resolveId(id, importer, options) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }

      if (
        importer &&
        importer.includes('/addons/') &&
        !id.startsWith('.') &&
        !id.startsWith('/') &&
        !id.startsWith('\0')
      ) {
        const coreEntryPoint = path.resolve(__dirname, 'src/index.tsx');
        return this.resolve(id, coreEntryPoint, { skipSelf: true, ...options });
      }
      return null;
    },
    load(id) {
      if (id !== resolvedVirtualModuleId) {
        return null;
      }

      const enabledAddonIds = getEnabledAddonIds(env);

      if (enabledAddonIds.length === 0) {
        return `
// Virtual Addons Registry (No addons enabled)
export const addonRoutes = [];
export const addonSlots = {};
export const addonReducers = {};
export const addonMiddlewares = [];
`;
      }

      const importStatements: string[] = [];
      const routeArrays: string[] = [];
      const slotObjects: string[] = [];
      const reducerSpreads: string[] = [];
      const middlewareSpreads: string[] = [];

      enabledAddonIds.forEach((addonId, index) => {
        const safeVar = `addon_${addonId.replace(/[^a-zA-Z0-9]/g, '_')}_${index}`;
        const addonDirCandidates = [
          path.resolve(process.cwd(), '../addons', addonId),
          path.resolve(process.cwd(), 'addons', addonId),
          path.resolve(__dirname, '../addons', addonId),
        ];

        let addonDir: string | null = null;
        for (const candidate of addonDirCandidates) {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
            addonDir = candidate;
            break;
          }
        }

        if (!addonDir) {
          console.warn(`[vite-plugin-addons] Addon directory not found for: ${addonId}`);
          return;
        }

        const frontendDir = path.join(addonDir, 'frontend');

        // Check routes
        const routesFile = ['routes.ts', 'routes.tsx', 'routes.js'].map(f => path.join(frontendDir, f)).find(f => fs.existsSync(f));
        if (routesFile) {
          const normPath = routesFile.replace(/\\/g, '/');
          importStatements.push(
            `import * as ${safeVar}_routes_mod from '${normPath}';`,
            `const ${safeVar}_routes = ${safeVar}_routes_mod.routes || ${safeVar}_routes_mod.default || [];`
          );
          routeArrays.push(`...(${safeVar}_routes || [])`);
        }

        // Check slots
        const slotsFile = ['slots.ts', 'slots.tsx', 'slots.js'].map(f => path.join(frontendDir, f)).find(f => fs.existsSync(f));
        if (slotsFile) {
          const normPath = slotsFile.replace(/\\/g, '/');
          importStatements.push(
            `import * as ${safeVar}_slots_mod from '${normPath}';`,
            `const ${safeVar}_slots = ${safeVar}_slots_mod.slots || ${safeVar}_slots_mod.default || {};`
          );
          slotObjects.push(`${safeVar}_slots`);
        }

        // Check store
        const storeFile = ['store.ts', 'store.js'].map(f => path.join(frontendDir, f)).find(f => fs.existsSync(f));
        if (storeFile) {
          const normPath = storeFile.replace(/\\/g, '/');
          importStatements.push(
            `import * as ${safeVar}_store_mod from '${normPath}';`,
            `const ${safeVar}_store = ${safeVar}_store_mod.addonStore || ${safeVar}_store_mod.storeConfig || ${safeVar}_store_mod.default || {};`
          );
          reducerSpreads.push(`...(${safeVar}_store?.reducers || {})`);
          middlewareSpreads.push(`...(${safeVar}_store?.middlewares || [])`);
        }
      });

      return `
// Virtual Addons Registry (Enabled: ${enabledAddonIds.join(', ')})
${importStatements.join('\n')}

export const addonRoutes = [
  ${routeArrays.join(',\n  ')}
];

function mergeAddonSlots(...slotsList) {
  const merged = {};
  for (const slots of slotsList) {
    if (!slots) continue;
    for (const [slotKey, items] of Object.entries(slots)) {
      if (!Array.isArray(items)) continue;
      merged[slotKey] = [...(merged[slotKey] || []), ...items];
    }
  }
  return merged;
}

export const addonSlots = mergeAddonSlots(
  ${slotObjects.join(',\n  ')}
);

export const addonReducers = {
  ${reducerSpreads.join(',\n  ')}
};

export const addonMiddlewares = [
  ${middlewareSpreads.join(',\n  ')}
];
`;
    },
  };
}
