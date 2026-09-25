#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const addonsDir = path.join(repoRoot, 'addons');

if (!fs.existsSync(addonsDir)) {
  process.exit(0);
}

const addonDirs = fs
  .readdirSync(addonsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const sdkSource = path.join(__dirname, '../src/addons/addon-sdk.ts');
const sdkOutputDir = path.join(__dirname, '../dist-sdk');
const sdkGeneratedFile = path.join(sdkOutputDir, 'addons', 'addon-sdk.js');

try {
  execFileSync(
    'npx',
    [
      'tsc',
      sdkSource,
      '--rootDir',
      'src',
      '--outDir',
      'dist-sdk',
      '--target',
      'ES2022',
      '--module',
      'commonjs',
      '--skipLibCheck',
      '--esModuleInterop',
    ],
    { cwd: path.join(__dirname, '..'), stdio: 'inherit' }
  );

  // Copy shared json assets required by utils/sdk at runtime
  const sharedJsonFiles = ['postgresql-error-codes.json', 'sample-data.json'];
  const distSharedDir = path.join(sdkOutputDir, 'shared');
  fs.mkdirSync(distSharedDir, { recursive: true });
  for (const jsonFile of sharedJsonFiles) {
    const srcFile = path.join(__dirname, '../src/shared', jsonFile);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, path.join(distSharedDir, jsonFile));
    }
  }

  // Provide a runtime mapping for @worklenz/addon-sdk to the generated SDK in node_modules
  const sdkPkgDir = path.join(__dirname, '../node_modules/@worklenz/addon-sdk');
  fs.mkdirSync(sdkPkgDir, { recursive: true });
  fs.writeFileSync(
    path.join(sdkPkgDir, 'package.json'),
    JSON.stringify(
      {
        name: '@worklenz/addon-sdk',
        main: path.relative(sdkPkgDir, sdkGeneratedFile).replace(/\\/g, '/'),
        types: path.relative(sdkPkgDir, sdkSource).replace(/\\/g, '/'),
      },
      null,
      2
    )
  );
} catch (err) {
  console.warn('[Addon Build] Notice: sdk compilation fallback', err.message);
}

for (const addonId of addonDirs) {
  const tsconfigPath = path.join(addonsDir, addonId, 'backend', 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) {
    continue;
  }

  console.log(`[Addon Build] Compiling backend for addon: ${addonId}`);
  try {
    execFileSync(
      'npx',
      ['tsc', '-p', tsconfigPath],
      {
        cwd: path.join(repoRoot, 'worklenz-backend'),
        stdio: 'inherit',
      }
    );

    // Normalize any relative addon-sdk imports in emitted dist files to @worklenz/addon-sdk
    const distDir = path.join(addonsDir, addonId, 'backend', 'dist');
    if (fs.existsSync(distDir)) {
      const walk = (dir) => {
        for (const file of fs.readdirSync(dir)) {
          const full = path.join(dir, file);
          if (fs.statSync(full).isDirectory()) {
            walk(full);
          } else if (file.endsWith('.js')) {
            let content = fs.readFileSync(full, 'utf-8');
            if (content.includes('worklenz-backend/src/addons/addon-sdk')) {
              content = content.replace(/['"][^'"]*worklenz-backend\/src\/addons\/addon-sdk['"]/g, "'@worklenz/addon-sdk'");
              fs.writeFileSync(full, content, 'utf-8');
            }
          }
        }
      };
      walk(distDir);
    }
    console.log(`[Addon Build] Successfully compiled addon: ${addonId}`);
  } catch (error) {
    console.error(`[Addon Build] Error building addon ${addonId}:`, error.message);
    process.exit(1);
  }
}
