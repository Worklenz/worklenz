import { Express, RequestHandler } from "express";
import fs from "fs";
import path from "path";

export interface AddonManifest {
  id: string;
  name?: string;
  version?: string;
  requiresCore?: string;
  license?: string;
  migrationsTable?: string;
  apiPrefix?: string;
  dbPrefix?: string;
  backend?: {
    routes?: string;
    routePrefix?: string;
  };
  frontend?: {
    routes?: string;
    slots?: string;
    store?: string;
  };
}

/**
 * Resolves the absolute directory path of an addon.
 */
export function resolveAddonDir(addonId: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), "addons", addonId),
    path.resolve(process.cwd(), "../addons", addonId),
    path.resolve(__dirname, "../../../addons", addonId),
    path.resolve(__dirname, "../../../../addons", addonId),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  return null;
}

/**
 * Reads and parses the manifest.json for a given addon directory.
 */
export function readAddonManifest(addonDir: string): AddonManifest | null {
  const manifestPath = path.join(addonDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    return JSON.parse(raw) as AddonManifest;
  } catch (error) {
    console.error(`[Addon] Failed to parse manifest at ${manifestPath}:`, error);
    return null;
  }
}

/**
 * Dynamically loads and mounts all enabled addon backend routers.
 * Enabled addons are defined via the ENABLED_ADDONS environment variable.
 */
export function loadAddonRouters(app: Express, authMiddleware?: RequestHandler): void {
  const rawAddons = process.env.ENABLED_ADDONS || "";
  const enabledAddonIds = rawAddons
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (enabledAddonIds.length === 0) {
    return;
  }

  // Ensure backend node_modules is available when resolving dependencies inside addons
  try {
    const backendNodeModules = path.resolve(__dirname, "../../node_modules");
    const currentPaths = (process.env.NODE_PATH || "")
      .split(path.delimiter)
      .map((p) => p.trim())
      .filter(Boolean);

    if (!currentPaths.includes(backendNodeModules)) {
      currentPaths.push(backendNodeModules);
      process.env.NODE_PATH = currentPaths.join(path.delimiter);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Module = require("module");
      if (typeof Module._initPaths === "function") {
        Module._initPaths();
      }
    }

    // Register runtime mapping for @worklenz/addon-sdk so addon routes can require it without MODULE_NOT_FOUND
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Module = require("module");
    const sdkCandidates = [
      path.resolve(__dirname, "./addon-sdk.js"),
      path.resolve(__dirname, "../../build/addons/addon-sdk.js"),
      path.resolve(__dirname, "../addons/addon-sdk.js"),
      path.resolve(__dirname, "../../dist-sdk/addons/addon-sdk.js"),
      path.resolve(__dirname, "../dist-sdk/addons/addon-sdk.js"),
      path.resolve(__dirname, "./addon-sdk.ts"),
    ];
    const resolvedSdkPath = sdkCandidates.find((cand) => fs.existsSync(cand));
    if (resolvedSdkPath && typeof Module._resolveFilename === "function") {
      const origResolveFilename = Module._resolveFilename;
      Module._resolveFilename = function (request: string, parent: unknown, isMain: boolean, options: unknown) {
        if (request === "@worklenz/addon-sdk") {
          return resolvedSdkPath;
        }
        return origResolveFilename.call(this, request, parent, isMain, options);
      };
    }
  } catch {
    // ignore
  }

  console.log(`[Addon] Initializing enabled addons: ${enabledAddonIds.join(", ")}`);

  for (const addonId of enabledAddonIds) {
    const addonDir = resolveAddonDir(addonId);
    if (!addonDir) {
      console.warn(`[Addon] Directory for enabled addon "${addonId}" was not found. Skipping.`);
      continue;
    }

    const manifest = readAddonManifest(addonDir);
    const apiPrefix = manifest?.apiPrefix || addonId;
    const backendDir = path.join(addonDir, "backend");

    const routeCandidates = [
      manifest?.backend?.routes ? path.join(addonDir, manifest.backend.routes) : null,
      manifest?.backend?.routes ? path.join(backendDir, manifest.backend.routes) : null,
      path.join(backendDir, "dist", "addons", addonId, "backend", "routes.js"),
      path.join(backendDir, "dist", "routes.js"),
      path.join(backendDir, "routes.js"),
      path.join(backendDir, "routes.ts"),
      path.join(backendDir, "index.js"),
      path.join(backendDir, "index.ts"),
    ].filter(Boolean) as string[];

    let routeFile: string | null = null;
    for (const candidate of routeCandidates) {
      if (fs.existsSync(candidate)) {
        routeFile = candidate;
        break;
      }
    }

    if (!routeFile) {
      console.warn(`[Addon] No backend routes found for addon "${addonId}" in ${backendDir}`);
      continue;
    }

    try {
      // CommonJS dynamic require
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const imported = require(routeFile);
      const router = imported.default || imported.router || imported;

      if (!router) {
        console.error(`[Addon] Addon "${addonId}" routes file did not export a router`);
        continue;
      }

      const mountPath = `/api/v1/addons/${apiPrefix}`;
      if (authMiddleware) {
        app.use(mountPath, authMiddleware, router);
      } else {
        app.use(mountPath, router);
      }
      console.log(`[Addon] Successfully mounted addon "${addonId}" at ${mountPath}`);
    } catch (error) {
      console.error(`[Addon] Failed to mount backend router for addon "${addonId}":`, error);
    }
  }
}
